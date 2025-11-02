## 개요

그래프 RAG 검색기는 사이드카가 적재한 `rag_nodes`, `rag_edges`, `rag_chunks` 데이터를 이용해 사용자 질의에 대한 컨텍스트 번들을 만든다. 핵심은 **이미 저장된 요약/메트릭을 그대로 활용**하는 것이며, 검색 시 추가 LLM 호출은 발생하지 않는다. 임베딩 계산과 벡터 비교는 PostgreSQL + pgvector를 기반으로 한다.

## 처리 파이프라인
1. **쿼리 정규화 (Query Canonicalization)**  
   - 입력 문자열을 소문자/공백 정리, 특수문자 제거, 숫자·해시태그 추출.  
   - `persona:`, `campaign:`, `draft:` 프리픽스를 파싱해 필터 조건을 구성한다.  
   - 언어 감지는 간단한 문자 비율 기반 heuristic으로 태깅하고, 추가 LLM 호출은 금지한다.  
   - 결과물: `{normalized_text, filters{persona_ids, campaign_ids, owners}, language}`.

2. **임베딩 생성 (Query Embedding)**  
   - `apps.backend.src/services/embeddings.embed_texts` 호출.  
   - 사이드카와 동일한 모델/정규화(`settings.EMBED_DIM`, `settings.EMBED_NORMALIZE`)를 사용해 벡터 일관성을 유지한다.  
   - 동일 질의 반복 대비 Redis(`redis://`, Celery 브로커와 공유)에 60초 TTL 캐시(`rag:query:{hash}`).

3. **1차 후보 검색 (Vector Search)**  
   - Postgres pgvector에서 `SELECT ... ORDER BY rag_nodes.embedding <=> :query_vec LIMIT :k` 형태로 수행.  
   - `filters`에 따라 `owner_user_id`, `persona_id`, `campaign_id`를 WHERE 절로 추가한다.  
   - `rag_chunks`는 summary보다 긴 본문이 필요한 경우에만 `UNION ALL` 혹은 별도 쿼리로 조회, 결과는 `chunk.node_id` 기준으로 묶는다.  
   - 1차 결과는 노드 기준 최대 40개로 제한한다.

4. **그래프 확장 (Graph Expansion)**  
   - 선택된 노드에 대해 `rag_edges`를 따라 최대 2-hop까지 확장한다.  
   - `edge_type`에 따라 우선순위 가중치를 다르게 적용한다. (예: `produces` > `published_as` > `comment_on` > `related_trend` > `watches_publication`).  
   - 확장된 노드가 필터 스코프 밖이면 제외한다(예: 다른 사용자 소유 데이터).

5. **점수 및 중복 제거 (Ranking & Dedup)**  
   - 기본 점수는 코사인 유사도.  
   - 보정 항목: `rag_nodes.updated_at` 최신성, `node_type`별 선호도(예: persona > playbook > post_publication > insight_comment > trend > reaction_rule), 사용자 가중치.  
   - 동일 `source_table`/`source_id`는 가장 높은 점수를 남기고 제거한다.

6. **컨텍스트 조립 (Context Assembly)**  
   - 각 노드의 `summary`, 대표 chunk(상위 2개), `meta`를 꺼내어 `{header, body, metadata}` 구조로 만든다.  
   - 토큰 수(임시로 글자 수 1600자) 초과 시 chunk 길이를 줄이고, 별도의 요약 LLM 호출 없이 문장 단위로 잘라낸다.  
   - `source_ref`에는 원본 테이블과 PK, 필요 시 URL(permalink 등)을 포함한다.

7. **캐싱 & 피드백**
   - 최종 컨텍스트를 30~120초 TTL로 Redis에 저장(`rag:context:{query_hash}`)하여 동일 요청 반복 시 활용한다.
   - 프론트에서 특정 노드 채택/제외 정보를 보내면 `rag_feedback` 테이블 또는 Redis Sorted Set으로 누적하고, 향후 score 보정에 사용한다.

## 데이터 준비 체크리스트
- Celery 워커가 `graph_rag` 큐를 포함하여 실행 중이어야 한다 (`pnpm dev:celery`).
- Prometheus(`http://localhost:9090`)에서 `rag_nodes_processed_total`이 증가하는지 확인하여 백필 상태를 파악한다.
- `SELECT node_type, COUNT(*) FROM rag_nodes GROUP BY 1;`로 노드 분포(persona, draft, post_publication, insight_comment, reaction_rule 등)를 점검한다.
- pgvector 컬럼이 `vector(settings.EMBED_DIM)` 길이로 설정되어 있는지 확인한다 (`
  \d+ rag_nodes`).

## 기본 SQL 스니펫
아래 쿼리는 서비스 레이어 구현 전에 psql에서 바로 검증할 수 있는 최소 예제다.

```sql
-- 1) 질의 벡터는 애플리케이션에서 생성하여 바인딩한다.
WITH query AS (
  SELECT $1::vector AS qvec -- 길이는 settings.EMBED_DIM와 동일해야 함
)
SELECT
  n.id,
  n.node_type,
  n.title,
  n.summary,
  (n.embedding <=> q.qvec) AS distance
FROM rag_nodes AS n
JOIN query AS q ON TRUE
WHERE n.embedding IS NOT NULL
  AND ($2::int IS NULL OR n.owner_user_id = $2)
  AND ($3::int[] IS NULL OR n.persona_id = ANY($3))
ORDER BY n.embedding <=> q.qvec
LIMIT 40;

-- 2) 선택된 node_id 집합을 대상으로 청크, 간선을 확장한다.
SELECT node_id, chunk_index, body_text
FROM rag_chunks
WHERE node_id = ANY($4)
ORDER BY node_id, chunk_index;

SELECT src_node_id, dst_node_id, edge_type
FROM rag_edges
WHERE src_node_id = ANY($4)
  AND edge_type IN ('produces','published_as','comment_on','watches_publication','related_trend');
```

## 서비스 구현 가이드
- **임베딩/캐시**: `apps.backend.src/services/embeddings.embed_texts`를 호출하고, 쿼리 텍스트 해시 기준으로 Redis TTL(60초)을 적용한다.
- **리포지토리**: `GraphNode`/`GraphEdge`를 SQLAlchemy Core `text()`로 조회하거나, 별도 DAO를 만들어 복잡한 필터를 관리한다.
- **랭킹**: 벡터 거리 외에 노드 타입별 가중치, 최신성(`updated_at`)을 포함하여 최종 점수를 계산한다.
- **그래프 확장**: 1-hop 확장 후 필요시 2-hop까지 반복하되, hop당 최대 10개 노드로 제한하여 폭발을 예방한다.
- **컨텍스트 조립**: `{ "header": title, "score": 1 - distance, "chunks": [...], "metadata": meta, "source_ref": {"table": source_table, "id": source_id} }` 형태로 묶는다.

예시 함수 시그니처:

```python
async def search_rag(
    *,
    db: AsyncSession,
    user_id: int,
    query_text: str,
    persona_ids: list[int] | None = None,
    campaign_ids: list[int] | None = None,
    limit: int = 6,
) -> list[dict]:
    ...
```

## REST API 사용 예시
- API 엔드포인트: `POST /rag/search`
- 요청 예시:

```bash
curl -X POST http://localhost:8000/rag/search \
  -H "Content-Type: application/json" \
  -d '{
        "user_id": 42,
        "query": "캠페인 댓글 요약",
        "persona_ids": [12],
        "campaign_ids": []
      }'
```

- 응답 예시 (권장 포맷):

```json
{
  "items": [
    {
      "header": "Comment by Alice",
      "score": 0.82,
      "node_type": "insight_comment",
      "chunks": ["Metrics: {\"likes\": 42}", "Raw payload: ..."],
      "metadata": {"platform": "INSTAGRAM"},
      "source_ref": {"table": "insight_comments", "id": 9012}
    }
  ]
}
```

## 로컬 테스트 흐름
- `pnpm dev:backend`와 `pnpm dev:celery`를 동시에 실행한다.
- Celery beat가 `rag_watch_*` 태스크를 주기적으로 실행하는지 `celery -A apps.backend.src.core.celery_app:celery_app events`로 확인한다.
- psql에서 위 SQL 스니펫을 실행해 결과가 나오는지 확인한다.

## 노드 타입별 검색 힌트
| Node Type | 주요 필드 | 연결 Edge |
| --- | --- | --- |
| `persona` | `summary`, `pillars`, `style_guide`, `default_hashtags` | `persona -> campaign`, `persona -> playbook`, `persona -> draft` |
| `campaign` | 캠페인 설명, 기간, KPI 요약 | `campaign -> playbook`, `campaign -> draft` |
| `draft` | IR 블록 텍스트, goal, 태그 | `draft -> variant`, `draft -> trend` |
| `draft_variant` | `rendered_caption`, `metrics`, CTA/해시태그 | `variant -> publication` |
| `post_publication` | caption, 게시 링크, 통계 | `publication -> insight_comment`, `publication -> reaction_rule` |
| `trend` | 제목, 뉴스 타이틀 모음 | `trend -> draft`, `trend -> playbook` |
| `reaction_rule` | 키워드/액션 설명 | `reaction_rule -> publication` |
| `insight_comment` | 댓글 본문, metrics, raw | `insight_comment -> publication` |

## 폴백 전략
- 상위 노드가 비어있다면 `ILIKE` 기반 키워드 검색을 수행하고 동일 파이프라인으로 확장한다.  
- 임베딩 서비스 장애 시 `services.embeddings`가 내장한 재시도(최대 5회) 이후에는 HTTP 오류를 API로 전달하고, 프론트는 “검색 지연” 알림을 띄운다.  
- 그래프 확장 결과가 고아 노드뿐이라면 해당 노드의 summary만 반환한다.

## 모니터링 & 로깅
- Prometheus 지표  
  - `rag_search_requests_total{node_type}`  
  - `rag_vector_query_latency_ms` (pgvector 쿼리 시간)  
  - `rag_context_size_tokens` (드라이 실행 시 토큰 추정치)  
- 로그: `query`, `top_node_ids`, `applied_filters`, `fallback_used` 필드를 JSON으로 남겨 디버깅에 활용한다.

## 향후 개선 아이디어
- 세션 기반 재순위: 동일 사용자 최근 선택 노드에 가중치 적용.  
- 다국어 질의 지원: `settings.EMBED_PROVIDER_URL`이 멀티벡터를 지원하면 언어별 벡터를 병합.  
- 그래프 피드백 루프: 피드백 누적 데이터를 이용해 `edge_type` 가중치를 동적으로 조정.

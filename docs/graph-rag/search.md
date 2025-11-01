## 개요

그래프 RAG 검색은 사용자 쿼리를 임베딩 기반 근접 검색과 그래프 확장을 결합하여, 대화형 응답이나 자동화 워크플로우에 필요한 컨텍스트를 구성한다. 사이드카가 백필한 `rag_nodes`, `rag_edges`, `rag_chunks`를 중심으로, 기존 도메인 테이블을 직접 조회하지 않고도 풍부한 문맥을 얻을 수 있다.

## 파이프라인 개요
1. **쿼리 정규화(Query Canonicalization)**  
   - 언어 감지 → 한국어/영어 등 입력 언어 태그  
   - Stopword 제거, 주요 엔터티(캠페인, 페르소나, 드래프트 번호 등) 추출  
   - 그래프 필터 조건 구성 (예: 특정 persona_id 범위)

2. **임베딩 생성(Query Embedding)**  
   - `services.embeddings.embed_texts` 호출  
   - 쿼리 벡터 정규화 후 캐시 (TTL 1분, 동일 질의 반복 대비)

3. **근접 노드 검색(Vector Search)**  
   - `rag_nodes.embedding <=> query_vec` 또는 `rag_chunks.embedding <=> query_vec`  
   - 상위 N개(기본 20) 후보 추출, node/chunk 혼합 시 `chunk.node_id`로 그룹화  
   - 사용자/캠페인 스코프로 필터링: `owner_user_id`, `persona_id`, `campaign_id`

4. **그래프 확장(Graph Expansion)**  
   - 후보 노드에서 `rag_edges`를 따라 k-hop(기본 2-hop) 확장  
   - 간선 가중치 및 edge_type에 따라 우선순위 부여 (예: `belongs_to` > `related_to`)  
   - 확장된 노드의 청크/메타 정보를 추가 확보

5. **결과 랭킹(Ranking & Dedup)**  
   - 기본 점수 = 벡터 유사도  
   - 보정 요소: 최신성(`rag_nodes.updated_at`), 노드 타입 우선순위, 사용자 제공 필터, 그래프 중심성  
   - 동일 `source_table/source_id` 중복 제거 → 가장 높은 점수만 유지

6. **컨텍스트 패키징(Context Assembly)**  
   - 노드 summary + 주요 청크(body_text) + 메타데이터를 LLM 컨텍스트 구조로 변환  
   - 최대 토큰 수 초과 시 요약 또는 chunk truncate  
   - `source_ref` 필드로 원본 도메인 정보(예: draft URL) 포함

7. **캐싱 & 피드백**  
   - 완성된 컨텍스트는 Redis/Local cache에 저장 (TTL 30초~5분)  
   - 사용자 피드백(선택/제외 노드)을 수집하여 점수 조정에 반영

## 쿼리 유형별 처리
| 유형 | 전략 |
| --- | --- |
| 페르소나/캠페인 요약 요청 | persona/campaign 노드 우선 검색, 관련 draft/playbook hop 확장 |
| 게시 성과 분석 | post_publication/insight_sample 중심, metrics 스냅샷 chunk 우선 |
| 트렌드 인사이트 | trend 노드 검색 후 연관 playbook/draft 연결 |
| 리액션 자동화 | reaction_rule 노드 검색, 연결된 insight_comment/DM 템플릿 포함 |

## 폴백 & 안전장치
- 벡터 검색 실패 시 키워드 매칭(`ILIKE`, trigram)으로 fallback 후 그래프 확장  
- 그래프 hop 중 고아 노드(간선 없음)만 존재할 경우 노드 자체 텍스트만 반환  
- 쿼리 임베딩 실패(embedding API 장애) 시 사이드카가 백업 모델 호출하도록 재시도

## 모니터링
- `search_requests_total`, `vector_latency_ms`, `graph_expansion_latency_ms` Prometheus 지표  
- 상위 미스 노드(검색 결과 없거나 fallback 사용) Top 10 리포트  
- 로그 샘플에 쿼리/선택된 node_id/score 기록 → 품질 평가

## 향후 개선
- 세션 기반 re-ranking(유저 대화 맥락 반영)
- 멀티 임베딩(다국어) 병합 전략
- 그래프 학습 기반 Edge weight 자동 조정(feedback loop)

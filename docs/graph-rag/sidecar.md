## 개요

그래프 RAG(Graph Retrieval Augmented Generation) 사이드카는 Celery beat가 주기적으로 발행하는 작업을 Celery 워커가 처리하는 구조로 동작한다. 백엔드 메인 API와는 분리된 `graph_rag` 큐에서 domain 테이블을 스캔하고, `apps.backend.src/modules/rag/models.py`에 정의된 `rag_nodes`, `rag_edges`, `rag_chunks` 테이블을 채운다. 임베딩은 이미 존재하는 데이터(드래프트 IR, 변환 결과, KPI 등)를 조합해 생성하며, 추가 요약을 위한 LLM 호출은 사용하지 않는다.

## 실행 구조
- **Beat → Worker**  
  - Celery 인스턴스는 `apps.backend.src/core/celery_app.py`에서 정의된다. 사이드카 작업은 여기에 `apps.backend.src.workers.RAG.*` 모듈을 포함시키고, `celery_app.conf.beat_schedule`에 감시 주기를 등록한다.  
  - Beat는 `celery -A apps.backend.src.core.celery_app beat`로 실행하고, 워커는 `celery -A apps.backend.src.core.celery_app worker -Q graph_rag -E`와 같이 별도 프로세스로 띄운다.
- **환경 설정**  
  - Redis 브로커(`settings.CELERY_BROKER_URL`)와 동기 DB URL(`settings.SYNC_DATABASE_URL`)을 공유해 재시도/락을 처리한다.  
  - 임베딩 서비스는 `apps.backend.src/services/embeddings.py`의 `embed_texts_sync`/`embed_texts`를 재사용한다.
- **큐 구성**  
- `graph_rag` 전용 큐를 두고, 사이드카 태스크는 모두 이 큐를 사용한다.  
- 워커는 `--concurrency`를 낮게 유지(기본 2~4)하여 DB 부하를 제어한다.

## 메트릭 수집(Prometheus)
- `infra/docker-compose.yml`에 `maestro-prometheus` 서비스를 추가하여 사이드카/백엔드 메트릭을 스크랩한다.  
- Prometheus 설정(`infra/prometheus.yml`) 기본 타깃  
  - Sidecar: `host.docker.internal:9600/metrics`  
  - Backend: `host.docker.internal:8000/metrics` (FastAPI `/metrics` 노출 필요)  
- 사이드카 프로세스는 `MAESTRO_SIDECAR_METRICS_PORT=9600` 환경 변수 또는 실행 옵션으로 HTTP 서버를 띄우고, `/healthz`, `/metrics`를 제공한다.  
- Grafana는 Prometheus(9090)와 연동하여 대시보드를 구성한다.

## 파이프라인 단계
1. **Watchers (Celery Beat Task)**  
   - 각 도메인 테이블을 `updated_at`, `graph_node_id`, 버전 컬럼(예: `ir_revision`, `compiler_version`)으로 스캔한다.  
   - 신규/변경 레코드를 batch 단위(기본 200개)로 `graph_rag.canonicalize` 작업에 enqueue한다.  
   - 초기 백필은 전수 스캔, 이후에는 `updated_at > last_synced_at` + `graph_node_id IS NULL` 조건을 조합한다.

   | Watcher 태스크 | 대상/기준 | Canonical 입력 | 비고 |
   | --- | --- | --- | --- |
   | `watch_personas` | `personas` (활성만) | `name`, `bio`, `pillars`, `style_guide`, 연결 `platform_accounts.handle` | Persona → Account edge 생성 |
   | `watch_campaigns` | `campaigns`, `campaign_kpi_defs` | `name`, 기간, KPI JSON | Persona/Playbook와 관계 |
   | `watch_playbooks` | `playbooks` + 최신 `playbook_logs` | KPI 요약, `summary`, 상위 로그 메시지 | Persona ↔ Campaign 양방향 |
   | `watch_drafts` | `drafts` (`ir_revision`, `tags`, `ir`) | IR 블록 텍스트, goal, 태그 | Variant/Publication과 edge |
   | `watch_variants` | `draft_variants` (`compiler_version`, `rendered_*`) | 캡션, 메트릭, 해시태그 리스트 | Draft ↔ Variant edge |
   | `watch_publications` | `post_publications` | 캡션, 링크, 스케줄 정보 | Variant/ReactionRule 연결 |
   | `watch_trends` | `trends`, `trend_news_items` | 제목, 뉴스 타이틀 | Trend ↔ Draft/Playbook edge |
   | `watch_insights` | `insight_comments`, `insights` | 코멘트 본문, 작성자 메타 | Persona/Publication edge |
   | `watch_reaction_rules` | `reaction_rules`, `reaction_rule_keywords` | 키워드/액션 설명 | Rule ↔ Publication edge |

2. **Canonicalizer**  
   - 각 watcher는 `CanonicalPayload`(예: `title`, `summary`, `body_sections`, `meta`, `signature`)로 정규화한다.  
   - 요약 문장은 `Draft.ir` 블록과 `DraftVariant.metrics` 등 이미 저장된 텍스트를 조합하여 생성하며, 추가 LLM 호출 없이 규칙 기반으로 정리한다.  
   - `signature_hash = sha256(node_type + source_id + updated_at + 주요필드)`로 변경 감지.

3. **Chunker & Embedding**  
   - Canonical payload에서 `summary` + `body_sections`를 350~400 토큰 기준으로 잘라 `GraphChunk` 후보를 만든다(토큰화는 SentencePiece/Word 수 기반 approximation).  
   - `services.embeddings.embed_texts_sync`를 통해 summary 1개 + 청크 N개의 벡터를 요청한다.  
   - 응답 벡터는 `settings.EMBED_DIM` 길이를 검증하고, 정규화(기본 활성화)를 적용한다.

4. **Graph Syncer**  
   - `GraphNode`(node_type, source_table, source_id)의 upsert를 수행하고, 결과 UUID를 원본 테이블 `graph_node_id`에 반영한다.  
   - `signature_hash`가 동일하면 임베딩·청크를 건너뛰고 타임스탬프만 갱신한다.  
   - `GraphChunk`는 `(node_id, chunk_index)` 멱등 키로 upsert한다.

5. **Edge Builder**  
   - 외래키 및 비즈니스 규칙으로 `GraphEdge`를 구성한다. 예)  
     - Draft → Variant (`edge_type=produces`)  
     - Variant → Publication (`edge_type=published_as`)  
     - Persona ↔ Campaign (`edge_type=belongs_to` / `collaborates_with`)  
     - Publication ↔ Trend (`edge_type=related_trend`, 링크 일치/해시태그 교집합 기반)  
   - 모든 간선은 `(src_node_id, dst_node_id, edge_type)` 조합으로 중복 제거한다.

6. **품질 & 재시도**  
   - 태스크 실패는 Celery 재시도(최대 5회, 지수 백오프).  
   - 반복 실패 레코드는 Redis `rag:dead_letter:{source_table}:{source_id}`에 JSON으로 저장하고, 운영자가 수동 재처리한다.  
   - 프로메테우스 메트릭: `rag_watch_duration_seconds`, `rag_nodes_processed_total`, `rag_embeddings_failures_total`.

## 슬랙 알람(Alerts)
- 환경 변수 `SLACK_ALERT_WEBHOOK_URL`이 설정되어 있으면 `apps.backend.src.core.celery_alerts.py`가 Celery `task_failure` 시그널을 구독해 `apps.backend.src.services.alerts.slack.notify_failure`를 호출한다.  
- `graph_rag` 큐에서 실패한 태스크만 Slack으로 전송하며, 메시지에는 태스크명, 예외 메시지, 재시도 횟수, payload 요약을 포함한다.  
- 워커 기동 시 `SLACK_ALERT_WEBHOOK_URL` 미설정이면 로그 경고 후 알람 전송을 건너뛴다.

## 백필 전략
- **초기 로드**: 테이블별 `SELECT ... ORDER BY updated_at ASC`를 batch(500개)로 나누어 순차 처리.  
- **증분 동기화**: Beat 스케줄 기본 2분. Draft/Variant는 30초, Trend는 5분 등 도메인 특성에 따라 상이하게 설정.  
- **버전 변경 처리**: Canonicalizer 규칙/임베딩 모델이 교체되면 `signature_hash`/`model_version`을 비교해 강제 재백필 태스크를 enqueue.

## 운영 체크리스트
- Alembic 마이그레이션(`apps/backend/migrations/versions/202501050001_add_graph_rag_tables.py`) 완료 여부 확인.  
- PostgreSQL `pgvector` 확장 설치.  
- `.env`에서 `CELERY_*`, `EMBED_PROVIDER_URL`, `EMBED_DIM`, `EMBED_NORMALIZE` 설정 확인.  
- 사이드카 배포 시 Celery beat 스케줄 파일(`celerybeat-schedule.*`) 볼륨 공유로 재시작 후에도 오프셋 유지.  
- 모니터링: Grafana/Prometheus 대시보드에 사이드카 지표 추가, 슬랙 알람(webhook)으로 실패 래치 알림.

## TODO / 향후 개선
- CDC(예: Postgres logical decoding)로 폴링을 대체하여 지연 감소.  
- `rag_nodes` 그래프 통계 자동화(고아 노드, 차수 분포, 최신성).  
- Canary 백필: 새로운 Canonicalizer 규칙을 그림자 노드에 적용해 비교.  
- Edge 추천: 사용자 피드백 기반 확률적 edge weight 학습.

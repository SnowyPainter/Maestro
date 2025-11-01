## 개요

그래프 RAG(Graph Retrieval Augmented Generation)를 위한 데이터 백필은 API 서버의 주 업무 트래픽과 분리된 사이드카 프로세스가 담당한다. 사이드카는 기존 도메인 테이블(드래프트, 플레이북, 캠페인 등)에서 그래프 노드를 생성·갱신하고, 벡터 임베딩/청크를 계산한 뒤 `rag_nodes`, `rag_edges`, `rag_chunks` 전용 테이블에 반영한다.

## 목표
- 운영 트래픽에 영향을 주지 않는 비동기 파이프라인
- 도메인 변경 사항을 빠르게 그래프에 반영
- 데이터 품질(멱등성, 재시도, 모니터링) 확보
- 초기 마이그레이션과 지속 동기화(near-realtime delta sync) 지원

## 주요 기능
1. **감지(Watchers)**  
   - 테이블별 `updated_at`/`graph_node_id` 기준으로 백필 대상 스캔  
   - 초기 백필 시 batched full scan, 이후에는 CDC(Change Data Capture) 큐 구독 또는 폴링

2. **정규화(Canonicalizer)**  
   - Raw JSON/IR을 자연어 문단, 키-값 메타, 구조화 메트릭으로 변환  
   - Draft/Variant → 캡션·CTA·해시태그 요약, Playbook → KPI 텍스트화 등

3. **임베딩(Embedding Worker)**  
   - `services.embeddings`를 재사용하여 노드/청크/메트릭을 벡터화  
   - 사용자 정의 모델/버전 추적을 위해 노드 메타에 `embedding_provider`, `model_version` 저장

4. **그래프 싱크(Graph Syncer)**  
   - `rag_nodes` Upsert (node_type, source_table, source_id 기준 멱등)  
   - 도메인간 관계를 Edge로 투영 (`draft`→`variant`→`publication`, `persona`→`campaign` 등)  
   - 청크 분할 규칙(최대 400 토큰, 요약/원문 혼합)

5. **품질·모니터링**  
   - 성공/실패 메트릭(prometheus) : 처리량, 재시도, 지연  
   - Grafana 알람: 백필 지연 > N분, 에러율 > 임계값  
   - 운영자 확인용 상태 페이지(API 또는 CLI)

## 구성 요소
| 구성 | 설명 |
| --- | --- |
| Sidecar Runner | Celery beat/worker 또는 독립 FastAPI + Background task |
| Watcher | 테이블 단위 스케줄러, 변경 감지 후 Job enqueue |
| Canonicalizer | 도메인별 파서 + 추가 요약 LLM 호출 |
| Embedding Adapter | Embedding API 호출, 벡터 검증(길이, 정규화) |
| GraphStore Client | SQLAlchemy AsyncSession 사용, rag_* 테이블 Upsert |
| Edge Builder | 외래키/비즈니스 규칙 기반 그래프 간선 생성 |

## 데이터 흐름
1. Watcher가 `drafts` 에서 `graph_node_id IS NULL OR updated_at > last_synced_at` 조건으로 레코드 수집  
2. 수집 레코드를 Canonicalizer에게 전달해 `CanonicalPayload` 생성  
3. Embedding Worker가 CanonicalPayload의 텍스트를 벡터화  
4. Graph Syncer가 `rag_nodes` upsert 후 `graph_node_id`를 원본 테이블에 업데이트  
5. Edge Builder가 관계 정보로 `rag_edges`, 텍스트 조각으로 `rag_chunks`를 삽입  
6. 성공 시 처리 로그 기록, 실패 시 재시도 큐에 push

## 백필 전략
- **초기 마이그레이션**: 테이블별 배치 크기 500~1000, 병렬 워커 4~8개  
- **증분 동기화**: 1분 주기 폴링 또는 CDC 브로커(Kafka/Redis Stream)  
- **역호환**: `graph_node_id`가 비어있는 레코드에 대해서도 기존 API는 동작해야 하므로 백필 실패는 논블로킹  
- **버전 관리**: Canonicalizer/Embedding 버전이 변경되면 `signature_hash` 비교 후 재백필 트리거

## 장애 대응 & 멱등성
- 각 단계는 `source_table`, `source_id`, `canonical_version` 조합으로 멱등  
- Embedding API 타임아웃 시 지수 백오프 최대 5회 재시도  
- 그래프 테이블 Insertion 실패 시, 해당 `source_id`를 Dead Letter Queue에 기록하여 운영자가 후처리  
- 사이드카 자체 상태를 `/healthz`, `/metrics` 엔드포인트로 제공

## 운영 & 배포
- Docker 이미지로 패키징, API 서버와 동일 네트워크에 배포  
- `.env` 에서 동기화 대상, 배치 크기, 워커 수 설정  
- Helm/Compose에서 사이드카 컨테이너를 API 및 Celery와 함께 띄우되, 리소스 제한(cpu/mem) 별도 설정  
- 릴리즈 시 케어해야 할 항목:  
  - Alembic 완료 여부  
  - pgvector 설치  
  - Embedding Provider URL 가용성  
  - 초기 백필 완료를 위한 임시 높은 워커 수

## TODO / 향후 개선
- CDC 브로커 도입 및 watch latency 단축  
- 그래프 통계(차수, 노드 수, 고아 노드) 자동 보고서  
- Canary 백필: 새로운 Canonicalizer 버전 테스트를 위한 그림자 그래프  
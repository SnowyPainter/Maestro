# Playbook Pipeline: Two Core Values

Playbook은 “로그가 쌓이는 곳”을 넘어, **브랜드 운영자가 바로 활용할 수 있는 지식 베이스**가 되는 것을 목표로 한다.  
우리가 구축하려는 파이프라인은 두 가지 가치를 동시에 제공해야 한다.

---

## 1. 트렌드·상황 → 액션 히스토리

### 목표
- “어떤 트렌드/상황에서 어떤 액션을 실제로 실행했는가?”를 시간 축으로 명확하게 파악한다.
- A/B 테스트, 게시, LLM 생성, 인사이트 수집 등 모든 활동을 하나의 타임라인에 기록한다.

### 구성 요소
| 요소 | 설명 | 현재 상태 |
| --- | --- | --- |
| **PlaybookLog** | 이벤트 단위 기록 (`event`, `timestamp`, `meta`, `kpi_snapshot`, `llm_input/output`, …) | 구현 완료 |
| **Persona Snapshot** | 이벤트 시점의 페르소나 프로필/스타일 정보 | `record_playbook_event`에서 자동 생성 |
| **Trend Snapshot** | 페르소나 언어/국가 기반 최신 트렌드 (최대 3개) | 자동 생성 (Datetime → ISO 변환) |
| **LLM Trace** | CoWorker 등 생성형 활동의 input/output | `coworker.generated_text` 로그에 저장 |
| **KPI Snapshot** | A/B 테스트, metrics sync 이벤트가 제공하는 성과 지표 | 이벤트별로 공급 |

### 구현 흐름
1. 서비스 코드(스케줄, 게시, LLM 등)에서 `record_playbook_event` 호출  
2. 내부에서 persona/campaign/draft 등을 추론하고 스냅샷 자동 생성  
3. 로그를 INSERT + Playbook의 `last_event`, `last_updated` 갱신  
4. (추가 예정) 이벤트별 Aggregator가 요약 필드를 업데이트  

### 기대 효과 & 활용 예시
- 지난달에 어떤 트렌드가 어떤 콘텐츠/스케줄/AB 테스트로 이어졌는지 회고 레포트 작성
- 특정 이벤트(예: LLM 생성) 이후 실제로 게시·성과까지 이어졌는지 추적
- 고객/에이전시와의 리뷰 미팅에서 “이런 인사이트에 대응해 이런 액션을 했다”는 근거로 제공

---

## 2. 집계 기반 상태 요약

### 목표
- 로그를 전부 읽지 않아도 **Playbook 한 장**으로 현황을 이해한다.
- KPI, 최적 시간대, 상위 해시태그 등 반복 관측에서 얻은 인사이트를 바로 노출한다.

### 요약 필드
| 필드 | 의미 | 데이터 출처 (예시) |
| --- | --- | --- |
| `aggregate_kpi` | KPI Key → 최근/평균 값 | `sync.metrics`, `abtest.completed` 의 `kpi_snapshot` |
| `best_time_window` | 게시/스케줄 성과가 가장 좋은 시간대 | `post.published`, `schedule.created` 로그 |
| `best_tone` | 반응이 좋았던 톤/스타일 | LLM 로그 + 성과 지표 |
| `top_hashtags` | 자주 쓰이고 성과가 좋은 해시태그 | LLM output, 게시 캡션 |

### 집계 파이프라인
1. **실시간 Aggregator**  
   - 이벤트별 함수가 `PlaybookAggregatePatch` 를 생성 (`aggregate_from_metrics`, `aggregate_from_abtest` …)  
   - `record_playbook_event`가 패치를 받아 `_apply_patch` 로 즉시 갱신
2. **백필 / 재빌드**  
   - `rebuild_playbook_aggregates(playbook_id)` 형태의 태스크로 과거 로그를 재계산  
   - 배치나 CLI에서 전체/부분 리빌드 실행 가능

### 기대 효과 & 활용 예시
- 대시보드에서 Playbook 카드 하나로 “현재 KPI·최적 시간대·상위 해시태그” 확인
- 스케줄러/추천 로직이 최적 시간대를 즉시 활용해 자동 배포
- LLM 프롬프트에 상위 해시태그나 최근 KPI를 주입하여 더 맥락 있는 콘텐츠 생성

---

## 지금 무엇을 할 수 있나?

1. **Playbook 타임라인 조회**
   - `playbook_logs` 를 시간순으로 조회하면 “트렌드 → 액션 → 결과” 흐름이 한눈에 나온다.
   - 페르소나·캠페인 스냅샷, LLM input/output, KPI 스냅샷이 함께 저장되므로 회고·보고용으로 즉시 활용 가능.

2. **Playbook 요약 데이터 활용**
   - `Playbook.aggregate_kpi`, `best_time_window`, `top_hashtags` 등 요약 필드가 실시간 갱신된다.
   - 대시보드/추천 로직/LLM 프롬프트가 이 필드만 읽어도 최신 현황을 파악할 수 있다.

3. **자동화 및 추천**
   - 스케줄링 로직이 `best_time_window`를 사용해 최적 시간대 자동 배치.
   - CoWorker 프롬프트에 `top_hashtags`, `aggregate_kpi`를 삽입해 더 맥락 있는 문장 생성.

4. **캠페인 KPI 재활용**
   - kpi_snapshot을 정의 기반으로 끌어와 Playbook과 Campaign 모듈이 같은 수치를 공유한다.
   - A/B 테스트 완료, metrics sync, manual fallback을 통해 KPI 스냅샷이 자동으로 채워진다.

5. **백필 및 모델링**
   - `calculate_campaign_kpis_snapshot`와 향후 `rebuild_playbook_aggregates`를 활용해 과거 로그도 재집계 가능.
   - 필요 시 배치/CLI에서 전체 Playbook을 리빌드해 최신 전략에 맞게 정리.

---

## 결론

- **로그 히스토리**는 “이 트렌드 → 저 액션”을 증명하고 회고하기 위한 원본 데이터다.  
- **집계 요약**은 그 히스토리를 바탕으로 현재 상태를 한눈에 보여주고, 다음 행동에 바로 쓰기 위한 데이터다.  
- 두 축이 함께 움직여야 Playbook이 “기록 + 인사이트 + 자동화”를 모두 제공하는 지식 베이스가 된다.

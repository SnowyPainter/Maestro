# Playbook Log 데이터 구조 및 이벤트 타입

## 개요

`playbook_logs` 테이블은 Maestro 시스템의 모든 브랜드 인텔리전스 활동을 기록하는 중앙 로그 시스템입니다. 각 로그는 특정 Persona와 Campaign의 조합에 대한 이벤트와 관련 데이터를 저장합니다.

## 테이블 구조

### 필드 설명 (총 16개 필드)

| 필드명 | 타입 | Nullable | 설명 |
|--------|------|----------|------|
| `id` | INTEGER | NO | Primary Key, Auto Increment |
| `playbook_id` | INTEGER | NO | Foreign Key → `playbooks.id`, CASCADE DELETE |
| `event` | VARCHAR(50) | NO | 이벤트 타입 (예: "post.published", "abtest.completed") |
| `timestamp` | TIMESTAMP WITH TIME ZONE | NO | 이벤트 발생 시간 (기본값: 현재 시간) |
| `draft_id` | INTEGER | YES | 관련 Draft ID |
| `schedule_id` | INTEGER | YES | 관련 Schedule ID |
| `abtest_id` | INTEGER | YES | 관련 A/B Test ID |
| `ref_id` | INTEGER | YES | 일반 참조 ID (다양한 용도로 사용) |
| `persona_snapshot` | JSON | YES | 이벤트 시점의 Persona 정보 스냅샷 |
| `trend_snapshot` | JSON | YES | 이벤트 시점의 트렌드 정보 스냅샷 |
| `llm_input` | JSON | YES | LLM 요청 입력 데이터 |
| `llm_output` | JSON | YES | LLM 응답 출력 데이터 |
| `kpi_snapshot` | JSON | YES | 이벤트 시점의 KPI 메트릭 |
| `meta` | JSON | YES | 추가 메타데이터 (이벤트별로 다름) |
| `message` | TEXT | YES | 자연어 요약 메시지 (LLM/ABTest 결과에서 추출) |
| `created_at` | TIMESTAMP WITH TIME ZONE | NO | 레코드 생성 시간 (기본값: 현재 시간) |

## 현재 상태 (2025-10-23 기준)

- **총 레코드 수**: 60개
- **총 이벤트 타입**: 10개
- **주요 이벤트 비율**: `sync.metrics` (22%), `abtest.completion_scheduled` (35%), `schedule.created.insights.sync_metrics` (10%)

## 이벤트 타입 분류 (총 10개 이벤트 타입)

### 1. 콘텐츠 생성 및 게시 이벤트

#### `coworker.generated_text`
- **설명**: CoWorker가 LLM을 통해 텍스트를 생성한 이벤트
- **llm_input**: `{"prompt": "사용자 프롬프트 텍스트"}`
- **llm_output**: `{"text": "생성된 콘텐츠 텍스트"}`
- **meta**: `{"platform": "threads"}` 등 플랫폼 정보
- **발생 위치**: `workers/CoWorker/generate_texts.py`

#### `post.published`
- **설명**: 소셜 미디어에 게시물이 성공적으로 게시됨
- **meta**: `{"external_id": "18296880853268954", "permalink": "https://threads.com/@user/post/abc", "platform": "threads"}`
- **발생 위치**: `orchestrator/flows/internal/drafts.py`

### 2. 스케줄링 이벤트

#### `schedule.created`
- **설명**: 새로운 스케줄이 생성됨
- **schedule_id**: 생성된 스케줄 ID
- **meta**: 스케줄 관련 메타데이터
- **발생 위치**: `modules/drafts/service.py`

#### `schedule.created.insights.sync_metrics`
- **설명**: 인사이트 메트릭 동기화를 위한 특화된 스케줄 생성
- **schedule_id**: 생성된 스케줄 ID
- **meta**: `{"template": "insights.sync_metrics", "plan_title": "Sync Account Metrics", "persona_account_id": 1, "platform": "threads", "identifiers": {"persona_account_id": 1, "post_publication_id": 14}}`
- **발생 위치**: 스케줄링 시스템

#### `schedule.cancelled`
- **설명**: 스케줄이 취소됨
- **schedule_id**: 취소된 스케줄 ID
- **meta**: `{"template": "abtest.complete_ab_test"}`
- **발생 위치**: `orchestrator/flows/action/schedule.py`

#### `abtest.scheduled`
- **설명**: A/B 테스트를 위한 스케줄이 생성됨
- **schedule_id**: 테스트 스케줄 ID
- **abtest_id**: 관련 A/B 테스트 ID
- **발생 위치**: `orchestrator/flows/action/schedule.py`

#### `abtest.completion_scheduled`
- **설명**: A/B 테스트 완료 처리를 위한 스케줄이 생성됨
- **schedule_id**: 완료 스케줄 ID
- **abtest_id**: 관련 A/B 테스트 ID
- **발생 위치**: `orchestrator/flows/action/schedule.py`

### 3. A/B 테스트 이벤트

#### `abtest.scheduled`
- **설명**: A/B 테스트를 위한 스케줄이 생성됨
- **schedule_id**: 테스트 스케줄 ID
- **abtest_id**: 관련 A/B 테스트 ID
- **발생 위치**: `orchestrator/flows/action/schedule.py`

#### `abtest.completion_scheduled`
- **설명**: A/B 테스트 완료 처리를 위한 스케줄이 생성됨
- **schedule_id**: 완료 스케줄 ID
- **abtest_id**: 관련 A/B 테스트 ID
- **meta**: `{"template": "abtest.complete_ab_test", "persona_account_id": 1, "post_publication_ids": [13, 14], "completion_schedule_id": 205, "complete_at": "2025-10-23T09:21:00+00:00"}`
- **발생 위치**: `orchestrator/flows/action/schedule.py`

#### `abtest.completion_ready`
- **설명**: A/B 테스트 완료 준비 상태
- **abtest_id**: A/B 테스트 ID
- **발생 위치**: 확인 필요

#### `abtest.completed`
- **설명**: A/B 테스트가 완료됨
- **abtest_id**: A/B 테스트 ID
- **meta**: `{"variable": "Diffrent topic", "winner_variant": "A", "uplift_percentage": 15.5, "variant_a_id": 13, "variant_b_id": 11, "hypothesis": "to be more comments"}`
- **message**: `"Variant B outperformed based on 'comments': 1.00 vs 0.00"` (자연어 요약)
- **발생 위치**: `modules/abtests/service.py`

### 4. 메트릭 및 인사이트 이벤트

#### `sync.metrics`
- **설명**: 소셜 미디어 메트릭이 동기화됨
- **persona_account_id**: 메트릭을 가져온 계정
- **meta**: 메트릭 데이터 (좋아요, 댓글, 공유 수 등)
- **kpi_snapshot**: KPI 스냅샷
- **발생 위치**: `orchestrator/flows/internal/insights.py`

### 5. 이메일 이벤트

#### `email.replied`
- **설명**: 이메일에 대한 답장이 생성됨
- **persona_id**: 답장한 페르소나
- **meta**: 이메일 관련 메타데이터
- **발생 위치**: `orchestrator/flows/internal/mail.py`

## 데이터 관계

### Playbook과의 관계
- 각 로그는 특정 `playbook`에 속함
- Playbook은 `persona_id` + `campaign_id`의 고유 조합
- Playbook은 `last_event`와 `last_updated`를 로그에서 업데이트

### 스냅샷 데이터 (자동 생성)
`record_playbook_event()` 함수에서 `persona_id`가 유효하고 페르소나 레코드를 찾을 수 있다면 다음 스냅샷들이 **항상 자동으로 생성**되어 저장됩니다:

```python
# service.py의 record_playbook_event 함수 로직
persona_row = await db.get(Persona, persona_id)
if persona_snapshot is None and persona_row is not None:
    persona_snapshot = _build_persona_snapshot(persona_row)
if trend_snapshot is None and persona_row is not None:
    trend_snapshot = await _build_trend_snapshot(db, persona_row, limit=3)
```

#### **persona_snapshot** (항상 생성)
이벤트 시점의 페르소나 전체 정보:

**실제 데이터베이스 예시:**
```json
{
  "id": 1,
  "name": "Tech Reviewer",
  "avatar_url": "https://randomuser.me/api/portraits/men/6.jpg",
  "bio": "reviewer hello.",
  "language": "en",
  "tone": null,
  "style_guide": "Very angry person, must use UK Slang.",
  "pillars": null,
  "default_hashtags": ["#AI", "#HR"],
  "posting_windows": null,
  "extras": {"replace_map": {"{{brand}}": "Acme"}},
  "updated_at": "2025-10-18T11:30:46.500029+00:00"
}
```

**포함되는 정보:**
- 기본 정보: `id`, `name`, `avatar_url`, `bio`
- 콘텐츠 설정: `language`, `tone`, `style_guide`, `pillars`
- 게시 설정: `default_hashtags`, `posting_windows`
- 확장 설정: `extras` (커스텀 필드들)

#### **trend_snapshot** (항상 생성)
페르소나의 언어/국가 정보를 기반으로 실시간 트렌드를 조회하여 저장 (최대 3개):

**국가 추론 로직:**
```python
def _resolve_country(persona: Persona) -> str:
    # 1. 페르소나 extras에서 country 정보 확인
    extras = persona.extras or {}
    country = extras.get("country") or extras.get("default_country")

    # 2. 언어 기반으로 기본 국가 설정
    if not country and persona.language:
        lang_map = {"ko": "KR", "en": "US", "ja": "JP", "zh": "CN"}
        country = lang_map.get(persona.language.lower(), "US")

    return str(country).upper()  # 기본값: "US"
```

**실제 데이터베이스 예시:**
```json
{
  "country": "US",
  "source": "db",
  "items": [
    {
      "id": 621,
      "country": "US",
      "rank": 1,
      "retrieved": "2025-10-23T19:43:09+00:00",
      "title": "all's fair",
      "approx_traffic": "100+",
      "link": "https://trends.google.com/trending/rss?geo=US",
      "pub_date": null,
      "picture": "http://localhost:9000/maestro-trends/trends/us/caacb1e5c6c44f119aa9df023e19f24a.jpg",
      "picture_source": "People.com"
    },
    {
      "id": 624,
      "country": "US",
      "rank": 2,
      "retrieved": "2025-10-23T19:43:09+00:00",
      "title": "start sit week 8",
      "approx_traffic": "200+",
      "link": "https://trends.google.com/trending/rss?geo=US",
      "pub_date": null,
      "picture": "http://localhost:9000/maestro-trends/trends/us/cf11dd941e07457885df7549a7175c67.jpg",
      "picture_source": "NFL.com"
    }
  ],
  "retrieved_at": "2025-10-23T10:58:24.904877"
}
```

**트렌드 데이터 구조 설명:**
- **country**: 추론된 국가 코드 (US, KR, JP 등)
- **source**: 트렌드 데이터 소스 ("db" = 내부 데이터베이스)
- **items**: 최대 3개의 트렌드 아이템 배열
  - `title`: 트렌드 제목/키워드
  - `rank`: 순위
  - `approx_traffic`: 예상 트래픽량
  - `picture`: 관련 이미지 URL
  - `picture_source`: 이미지 출처

#### **kpi_snapshot** (선택적)
현재 KPI 상태 (참여율, 도달 범위 등) - 이벤트에 따라 포함될 수 있음

### 참조 관계
로그는 다음 엔티티들과 연결될 수 있음:
- `draft_id` → Drafts 테이블
- `schedule_id` → Schedules 테이블
- `abtest_id` → ABTests 테이블
- `ref_id` → 다양한 참조용 ID

## 사용 예시

### 최근 이벤트 조회
```sql
SELECT event, timestamp, meta
FROM playbook_logs
WHERE playbook_id = ?
ORDER BY timestamp DESC
LIMIT 10;
```

### 특정 페르소나의 활동 타임라인
```sql
SELECT pl.event, pl.timestamp, pl.message, p.name as persona_name
FROM playbook_logs pl
JOIN playbooks pb ON pl.playbook_id = pb.id
JOIN personas p ON pb.persona_id = p.id
WHERE p.id = ?
ORDER BY pl.timestamp DESC;
```

## 메타데이터 구조 예시

### post.published 이벤트
```json
{
  "external_id": "post_12345",
  "permalink": "https://instagram.com/p/abc123",
  "platform": "instagram",
  "posted_at": "2024-01-15T10:30:00Z"
}
```

### abtest.completed 이벤트
```json
{
  "variable": "Diffrent topic",
  "winner_variant": "A",
  "uplift_percentage": 15.5,
  "variant_a_id": 13,
  "variant_b_id": 11,
  "hypothesis": "to be more comments"
}
```

### schedule.created.insights.sync_metrics 이벤트
```json
{
  "template": "insights.sync_metrics",
  "plan_title": "Sync Account Metrics",
  "plan_segment": "now",
  "schedule_index": 0,
  "queue": "insights",
  "due_at_utc": "2025-10-23T11:03:00",
  "plan_local_due": "2025-10-23T20:03:30+09:00",
  "dag_label": "insights.sync_metrics",
  "dag_nodes": 1,
  "dag_edges": 0,
  "dag_meta": {
    "label": "insights.sync_metrics",
    "post_publication_id": "14",
    "persona_account_id": "1",
    "platform": "threads",
    "title": "Sync Account Metrics"
  },
  "identifiers": {
    "persona_account_id": 1,
    "post_publication_id": 14
  }
}
```

### LLM 데이터 구조 예시

#### coworker.generated_text 이벤트
**llm_input:**
```json
{
  "prompt": "Write start writing... about test mid term"
}
```

**llm_output:**
```json
{
  "text": "Alright, let's get down to brass tacks, yeah? This whole test mid term thing? Proper headache, innit? Seems like everyone's losing their marbles. Remember that BYND post? Same energy. Stop faffing about and get your heads in the game. Focus. It's the only way to avoid a right royal cock-up. #AI #HR"
}
```

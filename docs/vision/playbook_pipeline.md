# Playbook Aggregation Pipeline

이 문서는 `playbook_logs` 에 누적되는 이벤트를 Playbook 요약 정보(`Playbook.aggregate_kpi`, `best_time_window`, `top_hashtags` …)로 자동 갱신하는 파이프라인 설계를 정리한 것이다.  
현재 코드 기준으로 동작하는 부분과 앞으로 구현/보완해야 할 단계까지 모두 문서화한다.

---

## 1. 로그 수집 단계

| 단계 | 설명 | 관련 코드 |
| ---- | ---- | --------- |
| ① 이벤트 트리거 | 스케줄 생성, 게시, A/B 테스트 완료, CoWorker LLM 호출 등에서 `record_playbook_event` 호출 | `modules/drafts/service.py`, `modules/abtests/service.py`, `workers/CoWorker/generate_texts.py`, … |
| ② 필수 ID 해석 | `record_playbook_event` 내부에서 `persona_id`, `campaign_id`, `draft_id`, `variant_id`, `post_publication_id` 등을 추론 | `playbooks/service.py:215` 이하 |
| ③ 자동 스냅샷 생성 | `persona_snapshot` / `trend_snapshot` 자동 채움, 필요 시 KPI 스냅샷 생성 | `playbooks/service.py:245` |
| ④ PlaybookLog 저장 | `PlaybookLogCreate` → `record_event` → DB INSERT. 동시에 `Playbook.last_event`, `last_updated` 갱신 | `playbooks/service.py:110` |
| ⑤ 집계 패치 적용 (추가 예정) | 이벤트별 Aggregator가 `PlaybookAggregatePatch` 를 생성 → `_apply_patch` 로 Playbook 요약 필드 갱신 | 본 문서 2절 참조 |

> **결론:** 로그는 자동으로 남지만, Playbook 요약 필드가 갱신되려면 ⑤단계 구현이 필요하다.

---

## 2. 실시간 집계 (Aggregator) 설계

### 2.1 이벤트 ↔ Aggregator 매핑

```python
AGGREGATORS = {
    "sync.metrics": aggregate_from_metrics,
    "abtest.completed": aggregate_from_abtest,
    "coworker.generated_text": aggregate_from_llm,
    "post.published": aggregate_from_publications,
    "schedule.created": aggregate_from_schedule,
    # 필요 시 추가
}
```

각 Aggregator는 다음 시그니처를 따른다.

```python
async def aggregate_from_metrics(
    db: AsyncSession,
    *,
    playbook: Playbook,
    log: PlaybookLogCreate,
) -> PlaybookAggregatePatch | None:
    ...
```

**적용 흐름**
1. `record_playbook_event`에서 INSERT 직후 이벤트명으로 Aggregator 조회  
2. Aggregator가 `PlaybookAggregatePatch`를 반환하면 `_apply_patch` 호출  
3. 변경된 Playbook은 동일 트랜잭션 내에서 커밋

### 2.2 Aggregator 예시

| 이벤트 | 입력 데이터 | 갱신 대상 | 비고 |
| ------ | ----------- | ---------- | ---- |
| `sync.metrics` | `kpi_snapshot` | `aggregate_kpi` (누적 평균 or 최근 값) | KPI Key → KPI Value 맵 |
| `abtest.completed` | `kpi_snapshot`, `meta`, `message` | ① KPI 합산<br>② `last_event`는 기존 로직으로 갱신 | 승리 변형 기록 |
| `coworker.generated_text` | `llm_output["text"]` | `top_hashtags`, `best_tone` 후보 | 해시태그 파싱 / 스타일 분석 |
| `post.published` | `meta["platform"]`, `timestamp` | `best_time_window`, `aggregate_kpi` | 게시 시간대별 성과 집계 |
| `schedule.created` | `schedule.due_at`, `meta` | `best_time_window` 후보, `top_hashtags` | 계획 단계 데이터 반영 |

### 2.3 구현 체크리스트
- [ ] `playbooks/service.py` 에 `AGGREGATORS` 테이블 추가
- [ ] `record_playbook_event` 에 Aggregator 호출 로직 삽입
- [ ] 각 Aggregator 함수 구현 및 테스트
- [ ] Null/예외 시 안전하게 무시하도록 방어 로직 추가

---

## 3. 백필 / 재빌드 파이프라인

실시간 Aggregator가 도입되더라도, 과거 로그나 알고리즘 변경 시 재계산이 필요하다.  
이를 위해 “재빌드” 태스크를 제공한다.

### 3.1 API 설계 (의견)
```python
async def rebuild_playbook_aggregates(
    db: AsyncSession,
    playbook_id: int,
    *,
    since: datetime | None = None,
) -> Playbook:
    """Playbook의 모든 로그를 다시 스캔해서 aggregate 필드 재계산."""
```

### 3.2 처리 순서
1. 대상 Playbook의 로그 (`playbook_logs`) 를 시간 순으로 로딩
2. 초기 `PlaybookAggregatePatch()` 생성
3. 각 로그를 Aggregator에 전달 (실시간과 동일한 로직 재사용)
4. 완성된 Patch를 `_apply_patch`로 반영 후 커밋

### 3.3 운영 시나리오
- 배포 후 새 집계 로직을 적용할 때 전체/부분 재빌드
- 소정 기간(예: 24h) 내 갱신된 Playbook만 리빌드
- 문제 발생 시 관리용 CLI/관리자 API에서 on-demand 실행

---

## 4. 저장되는 스냅샷 구조 복습

`record_playbook_event` 호출 시 자동 생성되는 스냅샷:

| 스냅샷 | 내용 | 생성 조건 |
| ------ | ---- | --------- |
| `persona_snapshot` | Persona 프로필·스타일·해시태그 등 | Persona 조회 가능할 때 항상 |
| `trend_snapshot` | 국가 기준 최신 트렌드 3개 (Datetime → ISO 변환) | Persona 조회 가능할 때 항상 |
| `kpi_snapshot` | 이벤트별 KPI 메트릭 (예: A/B 테스트 승리 지표) | 이벤트 공급 시 선택 |
| `llm_input` / `llm_output` | LLM 프롬프트 및 결과 | CoWorker, LLM 기반 이벤트 |

> 트렌드 스냅샷은 `datetime` 을 ISO8601 문자열로 미리 변환하여 JSON 직렬화 문제를 방지한다.

---

## 5. 플레이북 모델 요약 필드

| 필드명 | 의미 | 갱신 주체 |
| ------ | ---- | --------- |
| `aggregate_kpi` | KPI 키별 누적 성과 (ex. 좋아요, 도달, CTR) | `sync.metrics`, `abtest.completed` |
| `best_time_window` | 게시/캠페인 관점 Best 시간대 | `post.published`, `schedule.created` |
| `best_tone` | 반응이 가장 좋은 톤 | LLM/게시 성과 기반 분석 |
| `top_hashtags` | 상위 해시태그 리스트 | LLM 생성 콘텐츠/게시물 해시태그 |
| `last_event` | 최신 이벤트 식별자 | 이미 `record_event`에서 자동 갱신 |
| `last_updated` | 마지막 갱신 시각 | `record_event`에서 자동 갱신 |

`_apply_patch` 가 각 필드를 덮어쓰는 형태이므로 Aggregator는 `PlaybookAggregatePatch`에 필요한 필드만 채우면 된다.

---

## 6. 향후 과제 / TODO

1. **Aggregator 구현**
   - [ ] KPI 누적 로직 설계 (가중치, 기간 등)
   - [ ] 시간대 분석 알고리즘 정의 (버킷 크기, 지표)
   - [ ] 해시태그 추출/랭킹 로직 확정
2. **실시간 파이프라인 연결**
   - [ ] `record_playbook_event`에 Aggregator 호출/커밋 추가
   - [ ] 이벤트별 테스트 작성
3. **백필 도구**
   - [ ] `rebuild_playbook_aggregates` 구현
   - [ ] 배치/관리 CLI 등록
4. **문서/관측**
   - [ ] 본 문서에 집계 규칙 버전 관리
   - [ ] 대시보드에서 요약 필드 표시 계획

---

## 7. 요약

- Playbook Log는 시스템 전반의 이벤트 허브이며, Aggregator를 통해 Playbook 요약 정보를 자동 갱신한다.
- Aggregator는 이벤트별로 독립 구현하며, 실시간/재빌드에 동일 로직을 재사용한다.
- 스냅샷(`persona`, `trend`, `kpi`, `llm_input/output`)은 자동으로 채워지므로 집계 로직에서 적극 활용할 수 있다.
- `PlaybookAggregatePatch`를 활용하면 업데이트 로직이 중앙화되고, 배치로 재빌드하기도 쉽다.

추가 변경 사항이나 알고리즘이 확정되면 이 문서를 업데이트한다.

# Persona Account Id

Persona Account Id가 현재 주입되어 있으면 일단, 이것을 중심으로 보여줌.
없거나, 따로 전체보기를 하면 모든 Persona Account Id 기준으로 모든걸 overlap 하여 보여줘야함

# 컨트롤 타워(페이지) 구조

* 상단: 기간/계정/플랫폼/캠페인 필터 + 검색(드래프트/Variant/해시태그)
* 본문 탭:

  1. **타임라인 뷰**: 업로드된/업로드할 이벤트(Brief/Draft/Schedule/Publish) 수평 타임라인 + 트렌드 Overlay
  2. **캠페인 뷰**: 캠페인별 누적 KPI 카드(클릭 시 상세 측정치/변곡점 타임라인)
  3. **모니터링 뷰**: 캠페인 외 Draft 포함 전체 인사이트 히트맵(클릭 시 상세)
* 우측 패널: 선택 항목 상세(포스트 미리보기, 로그, KPI 스파크라인, 연결 캠페인/계정)

---

# 컴포넌트 분해(재사용 가능)

* `ControlTowerPage` (상위 페이지 쉘)

  * `TimelinePanel` (타임라인 탭)

    * `EventTimeline` (PostPublication 레이어)
    * `TrendOverlay` (Sniffer 신호/키워드/미니차트)
    * `VariantInlineActions` (검색→발행/삭제/예약 버튼: **쓰기**는 Orchestrator로)
  * `CampaignPanel` (캠페인 탭)
    * `CampaignSummaryGrid` (누적 KPI 카드/스파크라인)
    * `CampaignDetailDrawer` (클릭 시 상세 타임라인·변곡점)
  * `MonitoringPanel` (모니터링 탭)
    * `InsightHeatmap` (일/주 단위 히트맵, Draft 단위)
    * `UnassignedDraftsList` (캠페인 미소속 Draft 큐 + “캠페인에 연결”)

* 공통/챗 재사용
  * `DraftCard`, `PostPreviewCard`, `MetricCard`, `TrendCard`, `ScheduleCard`(드래그앤드롭/시간 조정)

---

# 백엔드 BFF(Read) + Orchestrator(Write) 설계

원칙: **읽기(BFF)**·**쓰기(Orchestrator)** 분리. 모든 상태 변경은 **Orchestrator 단일 창구**로만 처리(멱등키)

## BFF (읽기 전용)

* `GET /bff/control-tower/timeline`
* `GET /bff/control-tower/campaigns`
* `GET /bff/control-tower/monitoring`

## Orchestrator (쓰기/행동)

* `POST /orchestrator/drafts/create-post-publication` (DraftVariant 예약)
* `PATCH /orchestrator/drafts/update-post-publication` (시간 변경/계정 변경)
* `POST /orchestrator/drafts/publish-post-publication` (즉시 발행)
* `POST /orchestrator/drafts/delete-post-publication` (게시물 삭제 지원 플랫폼 한정)

---

# UX 동작 디테일

## 타임라인 탭

* 좌: 이벤트 레이어(Draft/Schedule/Publish), 우: 트렌드 오버레이(키워드/세기 곡선).
* 상단 검색바: DraftVariant ID/텍스트로 **필터** → 카드 Hover시 `발행/예약/삭제` 액션 버튼.
* 드래그로 시간 이동 → `PATCH /actions/update-schedule` 호출.
* 실패/경고 이벤트는 SystemToast + 카드 배지로 표시(재시도 버튼).

## 캠페인 탭

* KPI 누적 카드 + 스파크라인, 클릭 시 상세 패널(일자별 지표, 변곡점과 해당 포스트/트렌드 링크).
* “잘 진행 중?”을 한눈 판단: 상태 배지(초록/노랑/빨강) 규칙은 KPI 목표 대비 편차로 계산.

## 모니터링 탭

* 히트맵: 날짜별 인사이트 스코어(노출/반응/이상치).
* 카드 리스트: **캠페인 미소속 Draft**도 동일하게 노출(= “컨텐츠 품질 및 퍼포먼스 감시” 오브젝트).
* 드래프트를 캠페인에 연결하거나(Attach) 독립적으로 예약/발행 가능.
* 트렌드 Overlay 토글(키워드 레이블 + 강도).

> 캠페인 외 객체까지 관제하는 별도 뷰 제공은 Sniffer/Synchro의 성격과 맞물림(개인화 임베딩/타임라인 대조).

---

# 이벤트 연동

* SSE/WS로 `/internal/events/*` 구독 → 타임라인 즉시 갱신(brief-ready, publish-done, metrics 등).
  ChatStream과 동일 채널을 사용하므로 “한 번 만든 걸 양쪽에서 쓴다”가 가능.

---

# 왜 이 구성이 맞나

* **읽기/쓰기 분리**: 안정·멱등·추적(SSOT) 원칙과 합치. 컨트롤 타워는 읽기 집중, 액션은 Orchestrator로.
* **Chat-first, Card-driven**: 컨트롤 타워의 컴포넌트를 그대로 ChatStream에 끼워넣을 수 있는 방식으로 설계.
* **트렌드 Overlay**: Sniffer/Synchro와 자연 결합(임베딩/변곡점 대조).
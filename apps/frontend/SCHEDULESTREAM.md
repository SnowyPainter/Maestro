좋아. “한 장(卡)” 안에 **TimelineViewport → LaneRow → ScheduleCard**를 **내포**시키는 구조로, 모든 책임을 `ScheduleStreamCard`가 쥐는 아키텍처/UX 가이드를 정리할게. (코드 없이 설계·계약만)

---

# 0) 핵심 원칙

* **단일 오브젝트 = ScheduleStreamCard**
  이 카드 한 장이 “하나의 시간창(window) 안에 보이는 타임라인 전체”를 스스로 렌더링한다.
  외부는 기간/줌/필터 같은 “질의 파라미터”만 넘기고, 화면·상호작용의 **상태권한은 카드 내부**에 집중.
* **내포 컴포넌트**는 전부 **프레젠테이셔널**: `TimelineViewport`, `LaneRow`, `ScheduleCard`는 상태를 갖지 않고, `ScheduleStreamCard`가 계산한 레이아웃/좌표/상호작용을 props로 전달.

---

# 1) 계층 책임 분리

## ScheduleStreamCard (컨테이너 · 상태/레이아웃/이벤트의 소유자)

* 가져오는 것: `window(start/end)`, `zoom`, `group_by`, `filters`, (옵션) `with_buckets`.
* **데이터 로드**: BFF 호출 → lanes/items 수신 → **좌표계 계산(px/sec, xAt)** → **충돌해소(sub-row)** → 가시성 윈도잉 계산.
* **상태 머신**:

  * View: `{idle | loading | ready | error}`
  * Interaction: `{none | hovered(item) | selected(item) | inspecting(item)}`
  * Net: `{synced | updating | eventPulse}` (SSE 반영 중 강조)
* **이벤트 버스**(내부):
  `card:select`, `card:hover`, `card:context`, `lane:hover`, `viewport:zoom`, `viewport:pan`, `live:update`
* **접근성/A11y 루트**: 키보드 포커스 관리(좌/우 스크롤, 상/하 레인 이동, Enter=Inspect, Esc=닫기)

## TimelineViewport (가로 스크롤 캔버스)

* 입력: `window`, `zoom`, `pxPerSec`, `visibleRange`, `onPan/Zoom` 핸들러, 가로/세로 padding.
* 역할: **클리핑/윈도잉**만 담당. 컨테이너 크기 변화 감지(ResizeObserver) → `pxPerSec` 재계산 트리거는 카드가 수행.
* 스타일: 가로 스크롤 가능, 상단/하단 가이드룰러, (옵션) 버킷 미니맵 오버레이.

## LaneRow (한 줄 트랙)

* 입력: `laneMeta(label, avatar, chips)`, `items[]`(이미 좌표/서브행 계산 완료), `rowHeight`, `gutter`, `onHover`, `onSelect`.
* 역할: 배경 강조(hover), sticky 라벨 영역, 행 경계/가이드 표시. **아이템 배치는 절대좌표**로만 수행.

## ScheduleCard (실제 이벤트 점/바)

* 입력: `id, x, width(핀=고정폭), status, label, template, due_at, queue, badges, subRowIndex`
* 역할: **표현/툴팁/컨텍스트 메뉴/포커스 링**. 클릭/우클릭/키보드 이벤트를 상위로 버블.
* 스타일: 합성 계층(`will-change: transform`), 상태색, 상단 1–2px 상태바, 실패 패턴(사선) 등.

---

# 2) 좌표·충돌·윈도잉 규칙

1. **좌표계**

   * `pxPerSec = viewportWidth / (end-start)` (오버스크롤 여백 1~2뷰폭 포함 가능)
   * `x = max(0, (t0 - start) * pxPerSec)`
   * 기간형이 없을 땐 `width = pinWidth(10~14px)`

2. **충돌 해소(sub-row)**

   * 같은 레인 내에서 `|x_i - x_j| < pinWidth + gap`이면 겹침 → **그룹화 후** `subRowIndex` 할당(0,1,2…).
   * 높이 = `rowHeight + subRowGap` * (maxSubRow+1).
   * `ScheduleStreamCard`가 **한 번에 계산**해서 각 `ScheduleCard`에 `subRowIndex`를 내려준다.

3. **윈도잉(가시성)**

   * `x + width`가 화면 왼쪽 밖이거나, `x`가 화면 오른쪽 밖이면 **렌더하지 않음**.
   * 좌/우 **프리패치 버퍼**(0.5~1.0 뷰폭) 유지 → 스크롤 중 깜빡임 제거.
   * 레인도 세로 가상화: 화면에 보이는 레인만 마운트.

---

# 3) 인터랙션 UX

* **줌(마우스 휠/터치)**: 중심 시간 고정(마우스 위치·터치 중심을 anchor로), 이산 줌 스텝(5m/15m/1h/3h/1d/1w).
* **패닝(Shift+휠 또는 드래그)**: `start/end`를 동일 길이로 이동. 끝단 도달 시 탄성 8–12px.
* **카드 Hover**: 테두리+lane 배경 옅게, 룰러에 가이드 라인 표시.
* **카드 Select**: 두꺼운 테두리 + 외곽 글로우, 우측 상세패널 오픈. URL에 `?item={id}` 싱크.
* **컨텍스트 메뉴**: Retry/Cancel/Copy link/Copy JSON. **실제 쓰기 호출은 카드 컨테이너가** 수행.
* **키보드**: `←/→`(시간축), `↑/↓`(레인 이동), `Enter`(Inspect), `Esc`(닫기), `+/-`(줌), `Home/End`(창 좌/우끝).

---

# 4) 시각 디자인(요소)

* **ScheduleCard**

  * 바탕: 상태색(슬레이트/블루/그린/레드/앰버) 70–80% 명도
  * 상단 상태바: 1–2px, 동일 색상의 진한 톤
  * 좌상단 배지(12px): 플랫폼/큐 아이콘(혼합 가능 시 스택)
  * 툴팁: label(크게) → template/queue → due_at(현지/UTC 토글) → status
  * 실패(failed): 점선 테두리+사선 패턴(저시력 대비 보조)

* **LaneRow**

  * 좌측 sticky 160–200px: 아바타(20–24px), 라벨, 칩(플랫폼/핸들)
  * 배경 zebra(미세), hover 시 4–6% 투명도 강조

* **TimelineViewport**

  * 상단 룰러: 시간 눈금(줌에 맞춰 간격/서브틱), 현재시간 마커(실시간 움직임)
  * 미니맵(옵션): 버킷 막대 + 드래그 핸들

---

# 5) 라이브 업데이트(SSE) 반영

* 수신 이벤트: `schedule.created/updated/deleted`
* **created**: 해당 레인에 삽입 → 페이드인(120ms) + 경미한 스케일 업
* **updated**: `status/x(=t0)` 변경 시 카드 위치·색 애니메이션(120–180ms), “pulse” 400ms
* **deleted**: 페이드아웃(120ms) → 언마운트
* **정렬 유지**: 동일 due_at 여러 개 변경 시에도 “현재 스크롤”과 “선택 카드”는 유지.
* 스로틀링: 빠른 연쇄 이벤트는 100–200ms 배치 후 일괄 적용.

---

# 6) 접근성 & 국제화

* `ScheduleCard`는 `role="button"` + `aria-pressed`(선택 여부) + `aria-label`(요약: “{label} at {time}, {status}”).
* 툴팁은 `aria-describedby` 연결. 포커스 링은 키보드 진입 시에만 노출.
* 날짜 표기 로컬라이즈(사용자 로케일), UTC 토글 제공.

---

# 7) 성능 최적화

* 모든 카드에 `will-change: transform` 적용(가로 스크롤/줌 부드럽게).
* hover/툴팁 업데이트를 `requestAnimationFrame` 또는 1프레임 지연(throttle) 처리.
* 레이아웃 재계산은 `ScheduleStreamCard`에서 **배치 단위**로 수행하고, 하위는 **pure render**.
* 수천 카드에서도 60fps 유지 목표:

  * 가시성 판단으로 offscreen `display:none`
  * 레인 가상화(react-virtual 등)
  * 좌표/충돌 계산은 O(n log n) 정렬 + 선형 스윕

---

# 8) 에러/로딩/엣지

* **로딩**: LaneRow별 스켈레톤 핀 6–10개(랜덤 위치/폭)
* **에러**: 상단 토스트 + 문제가 있는 카드만 테두리 플래시(1.2s)
* **빈 상태**: “이 기간엔 스케줄이 없습니다”와 기간 단축/확장 CTA

---

# 9) 테스트 체크리스트

* 줌 전환 시 **중심 시간 고정**되고 카드가 부드럽게 이동하는가
* 필터/그룹 변경 시 선택 카드가 유지되고 패널이 닫히지 않는가
* 대량 업데이트(SSE)에도 프레임 드랍 없이 반영되는가
* 키보드 내비게이션 경계 처리(맨 좌/우/상/하) 자연스러운가
* 실패 → 재시도 성공 시 시각적 피드백이 명확한가

---

# 10) 분석 이벤트(선택)

* 카드 클릭/컨텍스트 메뉴/툴팁 노출 시간(ms)
* 줌/패닝 빈도, 평균 세션당 선택 카드 수
* 실패→성공 전환까지 평균 경과 시간

---

## 결론

“**한 장짜리 ScheduleStreamCard**”가 **타임라인 전체의 지각·행동**을 소유하고, 그 안의 `TimelineViewport/LaneRow/ScheduleCard`는 렌더링에만 집중한다. 이렇게 하면 줌/패닝/필터/라이브 업데이트가 동시에 벌어져도 **좌표·선택·포커스의 연속성**이 보장되는 견고한 UX를 만들 수 있다.

# Design Guide (Frontend)

Maestro - Chat-first AI Orchestration System for Domain-Adapted Content Creation 

## 0) 원칙

* **Minimal / Calm**: 정보 밀도는 낮추고, 인터랙션은 필요할 때만.
* **Card-driven**: 거의 모든 산출물은 “카드(요약 + 액션)”로 표현.
* **Deterministic controls**: 실행/승인/롤백은 항상 명시적 버튼/폼.
* **Readable first**: 가독성(라인 길이 60–80자, 충분한 행간/여백) 우선.
* **Accessible by default**: 키보드/스크린리더/명확한 포커스링.

---

## 1) 테마 토큰(Shadcn 스타일, Tailwind 통합)

### 1.1 CSS Variables (src/styles/globals.css)

```css
:root {
  /* Base */
  --radius: 16px;                /* 2xl */
  --ring: 222 84% 56%;           /* focus ring hue */

  /* Palette (HSL) */
  --background: 0 0% 100%;
  --foreground: 222 14% 14%;

  --muted: 220 14% 96%;
  --muted-foreground: 222 9% 45%;

  --card: 0 0% 100%;
  --card-foreground: 222 14% 14%;

  --border: 220 14% 90%;
  --input: 220 14% 90%;

  --primary: 222 84% 56%;
  --primary-foreground: 0 0% 100%;

  --secondary: 210 80% 52%;
  --secondary-foreground: 0 0% 100%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  --warning: 38 92% 50%;
  --warning-foreground: 28 92% 10%;

  --success: 142 72% 30%;
  --success-foreground: 140 100% 96%;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: 222 14% 10%;
    --foreground: 210 20% 98%;
    --muted: 220 6% 18%;
    --muted-foreground: 220 8% 65%;
    --card: 222 14% 12%;
    --card-foreground: 210 20% 98%;
    --border: 220 8% 20%;
    --input: 220 8% 20%;
  }
}
```

### 1.2 Tailwind 확장 (tailwind.config.ts)

```ts
theme: {
  extend: {
    borderRadius: { xl: 'calc(var(--radius) - 4px)', '2xl': 'var(--radius)' },
    colors: {
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      muted: 'hsl(var(--muted))',
      'muted-foreground': 'hsl(var(--muted-foreground))',
      card: 'hsl(var(--card))',
      'card-foreground': 'hsl(var(--card-foreground))',
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      primary: 'hsl(var(--primary))',
      'primary-foreground': 'hsl(var(--primary-foreground))',
      secondary: 'hsl(var(--secondary))',
      'secondary-foreground': 'hsl(var(--secondary-foreground))',
      destructive: 'hsl(var(--destructive))',
      'destructive-foreground': 'hsl(var(--destructive-foreground))',
      warning: 'hsl(var(--warning))',
      'warning-foreground': 'hsl(var(--warning-foreground))',
      success: 'hsl(var(--success))',
      'success-foreground': 'hsl(var(--success-foreground))'
    },
    boxShadow: {
      sm: '0 1px 2px rgb(0 0 0 / 0.06)',
      md: '0 4px 12px rgb(0 0 0 / 0.08)',
      lg: '0 12px 24px rgb(0 0 0 / 0.10)',
    },
  }
}
```

### 1.3 타이포그래피 & 스페이싱

* 글꼴 크기: `12, 14, 16, 18, 20, 24, 28, 36` px (Tailwind: `text-xs`\~`text-4xl`)
* 행간(line-height): 본문 `1.7`, 카드/리스트 `1.5`, 헤더 `1.2`
* 기본 패딩: 카드 `p-4`(모바일) / `p-6`(데스크톱)
* 섹션 간격: `gap-4 / gap-6 / gap-8` (모바일→데스크톱 점진 증가)

### 1.4 레이아웃 브레이크포인트

* `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`
* 3-컬럼 기본(좌 내비 / 중 스트림 / 우 컨텍스트): `lg:` 이상에만 우측 레일 노출, 그 미만은 Drawer.

---

## 2) 인터랙션 & 모션

* 지속시간: `150ms`(tap), `200ms`(hover), `300ms`(enter/exit)
* 이징: `cubic-bezier(0.2, 0.0, 0, 1)` (빠른 시작, 부드러운 감속)
* 포커스: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`
* Hover 대비: 배경/테두리/그림자 중 **하나만** 강조 (세 가지 동시 적용 금지)
* `prefers-reduced-motion` 지원: 모션/블러를 비활성화

---

## 3) 컴포넌트 규칙(샘플 패턴)

### 3.1 카드(Card)

* 구조: 헤더(제목/상태 배지) → 본문(요약/폼) → 푸터(액션)
* 규칙:

  * 본문 대비 푸터는 경계선 `border-t`로 구분
  * 주요 액션은 항상 **우하단** 정렬, 보조는 좌측
  * 로딩/에러/빈상태(세 가지) UI 필수

```tsx
<div className="rounded-2xl border bg-card text-card-foreground shadow-md">
  <div className="p-6 flex items-center justify-between">
    <h3 className="text-lg font-semibold">Schedule</h3>
    <span className="text-xs px-2 py-1 rounded-full bg-muted">Draft</span>
  </div>
  <div className="px-6 pb-6">
    {/* form / content */}
  </div>
  <div className="px-6 py-4 border-t flex justify-end gap-3">
    <Button variant="outline">Cancel</Button>
    <Button>Confirm</Button>
  </div>
</div>
```

### 3.2 버튼(Button)

* 크기: `sm(28px) / md(36px) / lg(44px)` 높이
* 우선순위: `primary` > `secondary` > `outline` > `ghost`
* 파괴적 행동은 `destructive` 색상 + 2차 확인 모달 필수

### 3.3 폼(Form)

* 라벨은 항상 상단, 보조설명은 `text-muted-foreground`
* 에러 메시지: 즉시 인라인 표시 + 아이콘
* 저장 버튼은 **디스에이블** + 스피너(“비활성+로딩” 동시 금지)
* 날짜/시간: 자연어 입력 + DatePicker 동기화 (둘 중 하나만 실패해도 저장 막지 않음)

### 3.4 모달/드로어

* 닫기 아이콘 + ESC + 외부 클릭(옵션) 세 가지 경로 제공
* 모달 내부 스크롤, 배경은 고정
* 파괴적 모달은 확인용 체크박스(or 텍스트 입력) 허용

### 3.5 리스트/테이블

* 3열 이하: **카드 리스트** 선호
* 테이블 사용 시: 고정 헤더, 행 hover, 선택 체크박스, 빈 상태/에러/로딩 로우

### 3.6 차트(Recharts)

* 축/그리드 **연한 색**(`muted-foreground/20`)
* 범례는 모바일 숨김(md 이상 표시)
* 툴팁은 카드 스타일(반투명 배경 금지), 값은 단위/포맷 명확

### 3.7 상태 배지

* 예약: `secondary` / 발행: `success` / 실패: `destructive` / 취소: `muted`
* 텍스트는 10–12px, 대문자 금지, 여백 `px-2 py-0.5`, 라운드 pill

### 3.8 채팅 버블

* 좌(사용자) / 우(시스템/어시스턴트) 정렬 고정
* 긴 텍스트는 68–72ch에서 소프트랩
* 코드/프리포맷 블록은 `rounded-xl bg-muted p-3 text-sm overflow-auto`

---

## 4) 접근성(필수)

* 대비: 본문 텍스트 **4.5:1** 이상, 큰 텍스트 3:1 이상
* 포커스: 키보드 탐색 가능, Tab 순서는 시각 순서와 일치
* 역할/레이블: 상호작용 요소는 `role`/`aria-*` 제공
* 아바타/아이콘만 있는 버튼: `aria-label` 필수
* 라이브 리전: SSE로 오는 시스템 메시지는 `aria-live="polite"`로 공지

---

## 5) 반응형 규칙

* `lg:` 이상에서 3-컬럼. 그 미만은 우측 레일을 Drawer로 전환
* 내비는 모바일에서 아이콘 바텀 탭(또는 햄버거)
* 테이블은 모바일에서 카드로 변환(중요 필드만)

---

## 6) 컨텐츠 규칙

* 타이틀: 문장형, 최대 60자
* 본문: 짧은 문장, 리스트 우선, 링크는 문장 중간에 삽입하지 말고 **문장 끝**에
* 날짜/시간/통화: 지역화 처리(ko-KR), 상대시각은 절대시각 툴팁 제공

---

## 7) 컴포넌트 조합 베스트 프랙티스

* **ActionCard**: 폼 필드 → 검증 → Submit → 성공 토스트 → 카드 상태 업데이트
* **GuidelineCard**: 프롬프트 미리보기(접기/펼치기) + 토큰/비용 정보 + 실행 버튼
* **DraftPreviewCard**: 플랫폼 프리뷰(제약 안내) + “복사하기/저장/발행” 액션
* **TimelineItem**: 좌측 타임도트 + 우측 카드, 클릭 시 `/chat` 해당 앵커로 스크롤

---

## 8) 금지사항 (Never)

1. 그림자/색/모션 **3가지 이상 동시 강조**
2. 텍스트 버튼만으로 파괴적 액션(반드시 색/아이콘/확인 추가)
3. 토스트만 띄우고 **UI 상태 미동기화**
4. 모달 안에 또 모달(중첩 금지)
5. 무한 스피너(최대 10초, 이후 에러/재시도)
6. 작은 터치 타겟(모바일 44×44px 미만)
7. 카드 내부에 불필요한 스크롤 영역(가능하면 상위 스크롤)
8. 다크모드에서 대비 저하(토큰 준수 필수)

---

## 9) 컴포넌트 클래스 스니펫(복붙용)

```tsx
/* Card shell */
className="rounded-2xl border bg-card text-card-foreground shadow-md"

/* Section divider */
className="border-t mt-4 pt-4"

/* Primary button */
className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"

/* Ghost icon button */
className="h-9 w-9 rounded-xl hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"

/* Input */
className="h-10 w-full rounded-xl border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"

/* Badge */
className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
```

---

## 10) 검수 체크리스트

* [ ] 대비/포커스/키보드 네비 완비
* [ ] 카드 헤더/본문/푸터 구조 일관
* [ ] 파괴적 액션은 명확한 경고/확인
* [ ] 로딩/에러/빈상태 3종 모두 제공
* [ ] 모바일 360px에서 레이아웃 파손 없음
* [ ] 다크모드 토큰 준수, 스크롤/모달 정상
* [ ] 차트/테이블이 모바일에서 읽기 가능
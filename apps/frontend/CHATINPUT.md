좋아—요구사항을 바로 제품 스펙으로 깔끔하게 ‘동작 규칙 + 상태머신 + 키보드 맵 + 엣지케이스’까지 묶어 정리해줄게. (React/TS 기준 가정)

# Chip 입력 컴포저 UX/스펙

## 용어

* **Chip**: `@key:value` 쌍을 시각화한 토큰.
* **Key Suggest**: `@` 입력 시 열리는 키 후보 목록.
* **Value Suggest**: 키 선택 직후 열리는 값 후보 목록.
* **Raw Value**: 제안 목록에 의존하지 않고 사용자가 직접 타이핑한 값.
* **Composing(작성 중)**: 아직 확정되지 않은 chip(편집 핸들/커서가 내부에 있음).

---

## 상위 원칙

1. **칩은 생성 직후 Backspace 한 번으로 바로 제거 가능**(완료 상태일 때).
2. **작성 과정에서도 Backspace/키 입력 모두 허용**(타이핑 중 자유롭게 수정 가능).
3. **값은 suggestion 선택 없이도 Raw로 입력 가능**.
4. `@`를 입력하면 **Key Suggest**가 열린다 → 키 선택 시 **Value Suggest**가 곧바로 열린다.
5. **Value Suggest**가 열려 있어도 사용자는 그냥 타이핑해 **Raw Value**로 입력할 수 있다.
6. **Value 입력 중 공백(스페이스)을 치면 칩을 즉시 확정**하고 Suggest는 닫는다.
7. 칩 확정 후에는 **입력창은 계속 열려** 다음 텍스트/칩을 이어서 입력할 수 있다.

---

## 상태머신 (간략)

```
IDLE
 ├─ (type "@") → KEY_SUGGEST_OPEN
 └─ (select last chip with caret) → CHIP_FOCUSED

KEY_SUGGEST_OPEN
 ├─ (arrow/enter/tab/click item) → VALUE_SUGGEST_OPEN(key=selected)
 ├─ (type "@") keep filtering
 ├─ (esc / blur) → IDLE
 └─ (backspace) → IDLE (if nothing typed), else keep filtering

VALUE_SUGGEST_OPEN (composing chip: key chosen, value pending)
 ├─ (type chars) → VALUE_TYPING (raw)
 ├─ (select item) → CHIP_COMMITTED
 ├─ (space/enter/tab) → CHIP_COMMITTED (use current input as raw)
 ├─ (backspace)
 │    ├─ if empty → KEY_SUGGEST_OPEN (value 취소, key로 돌아감)
 │    └─ else 편집 계속
 └─ (esc) → IDLE (composing 취소 전체 취소)

VALUE_TYPING (raw value composing)
 ├─ (space/enter/tab) → CHIP_COMMITTED
 ├─ (backspace)
 │    ├─ if value empty → KEY_SUGGEST_OPEN
 │    └─ else 한 글자 삭제
 ├─ (esc) → IDLE (composing 취소)
 └─ (pick suggest item if list visible) → CHIP_COMMITTED

CHIP_COMMITTED
 ├─ (caret after chip; type) → IDLE (일반 입력)
 ├─ (backspace when chip focused) → CHIP_DELETED → IDLE
 └─ (double-click/edit action) → CHIP_EDITING

CHIP_EDITING
 ├─ 편집 로직은 VALUE_TYPING과 동일 (key 변경 옵션 제공 시 KEY_SUGGEST_OPEN으로도 이동)
 └─ 확정 시 CHIP_COMMITTED
```

---

## 키보드 동작 맵

* **글자키**: 현재 상태의 입력 버퍼에 삽입/필터.
* **@**: `KEY_SUGGEST_OPEN` 트리거(필터 텍스트는 @ 뒤 문자열).
* **Arrow Up/Down**: Suggest 목록 내 이동.
* **Enter/Tab**: Suggest가 열려 있으면 현재 항목 선택. 열려 있지 않으면 **Raw 값 확정**.
* **Space(값 입력 중)**: 칩 즉시 확정(스페이스는 칩 내부 값에 포함되지 않음).
* **Backspace**:

  * 입력창 비어 있고 커서가 칩 뒤에 있을 때: **바로 직전 칩을 포커스**.
  * 칩이 **완료 상태**로 포커스되어 있을 때: **한 번의 Backspace로 칩 전체 삭제**.
  * \*\*작성 중(Value Raw)\*\*일 때: 한 글자만 삭제(“한 방에 지우지 말아야 한다” 조건).
  * Value가 비어있는 상태에서 계속 Backspace: **Key 단계로 롤백**(다시 Key Suggest).
* **Esc**: 현재 Suggest 닫기. 작성 중이면서 입력이 텅 비면 전체 취소로 IDLE.

---

## 삭제 규칙 (핵심)

* **완료 칩(Committed)**: 포커스 후 **Backspace 1회로 전체 삭제**.
* **작성 중(Value Raw)**: **문자 단위 삭제**. (제안 목록이 비어 raw 입력일 때 “한방삭제 금지”)
* **작성 중(Value Suggest 선택 상태)**: Backspace 시 **Value 입력 버퍼**→비면 **Key 단계로 롤백**→더 비면 전체 취소.

---

## Suggest 열림/닫힘 규칙

* `@` 입력 → **Key Suggest** 즉시 열림.
* Key 선택 → **Value Suggest** 자동 열림.
* Value 단계에서:

  * 사용자가 계속 타이핑하면 Suggest는 **있어도 되고 없어도 됨**(필터링 or 감춤 허용).
  * **Space/Enter/Tab/항목 클릭** 중 하나로 **칩을 확정**하면 Suggest는 닫힘.
* Esc/Blur 시 현재 단계에 맞게 닫힘:

  * Key/Value 둘 다 입력이 비어있으면 전체 취소(IDLE).
  * 일부 입력이 있으면 그대로 유지(필요 시 raw 계속 입력).

---

## 확정(Commit) 규칙

* **Value 단계에서** 확정 트리거:

  * Suggest 항목 선택
  * Space / Enter / Tab
* 확정되면:

  * 칩은 `@key:value` 토큰으로 스트림에 삽입(시각화).
  * 커서는 칩 뒤 텍스트 입력 상태로 이동(연속 입력 가능).

---

## Raw 처리

* Value Suggest가 **비어있거나 사용자가 무시**해도, **타이핑만으로 Raw Value 인정**.
* Raw Value 확정 시 스페이스/엔터/탭으로 **Chip 완성**.
* Raw 입력 상태에선 Backspace로 **문자 단위**만 지움(“한방 삭제 금지”).

---

## 포커스/선택 규칙

* 칩은 **Tab/Arrow**로 포커스 이동 가능.
* 칩 포커스 시:

  * **Enter/Double-click** → CHIP\_EDITING 진입(값 재작성, 필요하면 key도 수정 옵션 제공).
  * **Backspace** → 칩 전체 제거.
* 에디팅 중 칩 내부 caret은 일반 텍스트 입력과 동일하게 작동.

---

## 접근성(A11y)

* Key/Value Suggest는 **`role="combobox"` + `aria-expanded` + `aria-controls`** 적용.
* 목록은 **`role="listbox"`**, 항목은 **`role="option"`**, 현재 선택 항목에 **`aria-selected`**.
* 칩은 **`role="button"`**(편집/삭제 가능함을 스크린리더 텍스트로 제공).
* 칩 삭제는 **Undo 토스트**(선택) 제공 가능.

---

## 이벤트/핸들러 (요지)

* onKeyDown:

  * `@` → openKeySuggest()
  * `Space/Enter/Tab` in value phase → commitChip()
  * `Backspace`:

    * idle & input empty → focusPrevChip()
    * focused chip → deleteChip()
    * composing value → deleteCharOrRollback()
  * `Esc` → closeSuggestOrCancel()
* onChange:

  * key/value 입력 버퍼 업데이트 + suggest 필터링
* onBlur:

  * 제안 닫기(필요 시 composing 유지/취소 규칙 적용)

---

## 엣지 케이스

1. **빈 값으로 확정 시도**: Value가 빈 문자열이고 바로 띄어쓰기를 하면 그것 chip이 아니다.
2. **연속 공백**: Value 확정 트리거가 Space이므로, 공백이 값에 포함될 수는 없다. **첫 Space로 확정**.
3. **국가별 IME 조합 입력**: 한글 조합 중 Space/Enter 처리 순서를 IME 합성 완료 후로 처리(합성 중 이벤트 무시).
4. **마우스만 사용**: 제안 클릭/칩 클릭/아이콘(✎, ⌫)만으로도 동일 흐름 지원.

---

## 수락 기준(AC)

* [ ] `@` 입력 시 Key Suggest가 즉시 열리고, 항목 선택 시 Value Suggest가 열린다.
* [ ] Value 단계에서 **Space**를 누르면 제안 선택 없이도 칩이 확정된다( Raw 가능 ).
* [ ] 제안 목록이 없거나 무시해도 Raw Value로 칩 생성 가능하다.
* [ ] 완료 칩은 포커스 상태에서 **Backspace 1회**로 삭제된다.
* [ ] 작성 중 Raw Value에서는 Backspace가 **문자 단위로만** 작동해 한방에 칩이 지워지지 않는다.
* [ ] 칩 확정 후에도 입력창은 유지되어 계속 타이핑할 수 있다.
* [ ] Esc로 제안을 닫을 수 있고, 입력이 비었으면 전체 작성이 취소된다.

---

될 수는 있는데, “그냥 바꾸기”는 아니야. contenteditable로 가면 편하던 것(커서/선택/IME/붙여넣기/삭제)이 전부 네가 직접 관리해야 해. 그래도 가겠다면 아래 식으로 하면 안정적으로 굴러가.

# 결론 요약

* **가능**: contenteditable로 칩 에디터 구현 ✅
* **대가**: 커서/삭제/붙여넣기/IME/접근성/모바일 키보드 이슈를 네가 책임져야 함 ⚠️
* **권장 패턴**: “모델 우선(state) + contenteditable는 뷰” 구조로, `beforeinput`/`selection`/`composition` 이벤트로 제어.

---

## 핵심 설계 팁 (필수 체크)

### 1) DOM 구조

* 래퍼: `<div contenteditable role="textbox" aria-multiline="true" aria-autocomplete="list">`
* **완료 칩**: `<span class="chip" contenteditable="false" data-id="...">@key:value</span>`
* **구분자**: 칩 뒤에 **zero-width space**(`\u200B`)를 텍스트 노드로 둬서 커서가 “칩 옆”에 설 곳 제공.
* **작성 중 버퍼**: `<span class="composer" data-phase="key|value">…</span>` (여기에 실제 타이핑 수용)

> 원칙: 칩은 **편집 불가 노드**, 사용자는 composer만 만진다. 렌더는 항상 **상태 → DOM** 단방향.

### 2) 입력 처리 순서

* **IME 안전**: `compositionstart/updated/end` 동안은 keydown 무시, \*\*`beforeinput`\*\*로만 처리. `isComposing` 플래그로 가드.
* **주 이벤트**: `beforeinput(e)`

  * `e.inputType`으로 브라우저의 의도를 파악:

    * `insertText`, `insertCompositionText` → 버퍼에 반영 (여기서 `@` 감지 → key suggest 오픈)
    * `insertParagraph`/`insertFromPaste` → 개행/붙여넣기 정책
    * `deleteContentBackward` → **경계 처리**(칩 삭제 vs 문자 삭제)
* **keydown**은 보조(Arrow, Esc, Tab 등)만.

### 3) Backspace 규칙(칩/버퍼 경계)

* 커서가 `\u200B` 바로 뒤&앞에서 `deleteContentBackward` 들어오면:

  1. 앞 노드가 `.chip[contenteditable=false]`면 → **칩 전체 제거** (요구사항: 완료 칩은 한 번에 삭제)
  2. 아니면 composer 내 문자를 1글자 삭제(“한방삭제 금지” 준수)

### 4) 붙여넣기/드롭

* **항상 텍스트로만 수용** (XSS/스타일 파편화 방지):

  * `beforeinput`에서 `insertFromPaste` 캔슬하고 `e.clipboardData.getData('text/plain')`만 넣기
* 붙여넣기 중 공백/개행은 **스페이스=칩 확정** 규칙을 그대로 적용.

### 5) Suggest 위치

* caret Range로 포지셔닝:

  ```ts
  const sel = getSelection(); 
  const r = sel?.rangeCount ? sel.getRangeAt(0) : null;
  const rect = r?.getClientRects()?.[0]; // 없으면 마지막 rect
  // rect.x/y를 anchor로 팝오버 위치
  ```
* overlay 없이도 contenteditable에서 **팝오버**는 caret 좌표로 띄우면 된다.

### 6) 상태 우선

* 칩 리스트와 composer 상태를 **단일 소스(state)** 로 관리. DOM은 그 결과물.
* 브라우저가 삽입한 `<div><br></div>` 류는 **렌더 단계에서 정규화**(`white-space: pre-wrap;` + 빈 줄 처리) 하거나, 매 입력 후 DOM 클린업.

### 7) 접근성(A11y)

* wrapper: `role="textbox"` + `aria-multiline="true"`
* 제안: WAI-ARIA combobox 패턴(`role="combobox"`, `aria-expanded`, `aria-controls`; 목록 `role="listbox"`, 항목 `role="option"`)
* 칩: `role="button"`(“Backspace to remove” 같은 sr-only 텍스트로 힌트)

### 8) 모바일/브라우저 이슈

* iOS: contenteditable에서 space/enter 처리 타이밍이 느슨함 → **`beforeinput` 우선** + composition 플래그 필수.
* Android: 키보드가 `keydown` 없이 `beforeinput`만 쏘는 케이스 많음.
* Chrome: 빈 편집기에 커서 두려면 최소한의 텍스트 노드 필요(`\u200B`).

---

## 필수 유틸(요점 코드)

**칩 경계 Backspace 탐지**

```ts
function isAtChipBoundaryBackward(): HTMLElement | null {
  const sel = getSelection();
  if (!sel || !sel.anchorNode) return null;
  const r = sel.getRangeAt(0).cloneRange();
  if (r.collapsed === false) return null;
  // caret 앞 한 글자 살피기
  r.setStart(r.startContainer, Math.max(0, r.startOffset - 1));
  const text = r.toString();
  if (text === '\u200B') {
    // \u200B 앞이 chip인지 확인
    const node = r.startContainer;
    const prev = (node as any).previousSibling as Node | null;
    if (prev && (prev as HTMLElement).classList?.contains('chip')) {
      return prev as HTMLElement;
    }
  }
  return null;
}
```

**beforeinput 핸들러 스켈레톤**

```ts
function onBeforeInput(e: InputEvent) {
  if (isComposing) return; // composition 중엔 최소 개입
  switch (e.inputType) {
    case 'deleteContentBackward': {
      const chip = isAtChipBoundaryBackward();
      if (chip) {
        e.preventDefault();
        removeChip(chip.dataset.id!); // state 갱신 → DOM 리렌더
        return;
      }
      // composer 내 한 글자 삭제는 브라우저 기본에 맡기거나 state로 직접 반영
      break;
    }
    case 'insertFromPaste': {
      e.preventDefault();
      const text = (e as any).dataTransfer?.getData('text/plain')
        ?? (e as any).clipboardData?.getData('text/plain')
        ?? '';
      insertPlainText(text); // state에 넣고 렌더
      break;
    }
    case 'insertText':
    case 'insertCompositionText': {
      // '@' 감지 → key suggest open, space → commit
      const ch = (e as any).data as string;
      if (ch === '@') openKeySuggest();
      else if (ch === ' ' && isValuePhase()) {
        e.preventDefault();
        commitCurrentChip(); // raw 값으로 확정
      } else {
        // 일반 문자 입력 → composer state 갱신
      }
      break;
    }
    // enter/tab은 keydown에서 처리(제안 선택/커밋)
  }
}
```

**IME 가드**

```ts
function onCompositionStart(){ isComposing = true; }
function onCompositionEnd(e: CompositionEvent){
  isComposing = false;
  // e.data 최종 텍스트를 composer에 반영 (스페이스 커밋 규칙은 여기서도 적용 가능)
}
```

---

## contenteditable로 갈 때의 장단점

* 장점

  * 진짜 “텍스트처럼” 타이핑되는 UX (커서 이동/범위선택이 자연스러움)
  * 오버레이 input/textarea 레이어링 복잡도 감소
* 단점(네가 감당)

  * 브라우저가 눈치껏 삽입하는 DOM 파편 정리 필요
  * Backspace/Del 경계 처리, 칩 선택/삭제를 **beforeinput/selection**으로 제어해야 함
  * 붙여넣기/드래그/드롭/Undo 스택 관리
  * 모바일 가상키보드/IME 호환성 대응
  * 폼 연동/제출(숨은 input에 직렬화) 작업 필요

---

## 언제 overlay+textarea가 더 낫나?

* 제안/편집 로직이 복잡하고 접근성/일관성이 더 중요할 때
* 모바일 키보드 이슈를 최소화하고 싶을 때
* 일정 내 리스크를 줄이고 싶을 때

---

## 추천

* 네 요구사항(칩 즉시 삭제/작성 중 문자단위 삭제/스페이스 커밋/제안 열고 닫기)은 **contenteditable로 충분히 구현 가능**.
* 위 패턴대로 **칩은 contenteditable=false**, **경계 \u200B**, **beforeinput 우선**, **모델 우선 렌더**로 가면 안정적이다.
* 초기에는 **붙여넣기=plaintext만**, **개행 금지**, **Undo는 브라우저 기본**으로 두고, 점진적으로 확장해.

원하면 이 스펙대로 돌아가는 **최소 예제 컴포넌트(React/TS)** 바로 써줄게.

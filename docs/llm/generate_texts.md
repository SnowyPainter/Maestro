# 맥락적 텍스트 생성

## 흐름 개요
- `generate_texts.py`는 원시 프롬프트, 페르소나, 캠페인 및 플랫폼 컨텍스트를 조합합니다.
- `StyleComposer`는 플랫폼 가이드, 페르소나 음성 규칙 및 언어별 퓨샷 예제를 사용하여 프롬프트를 강화합니다.
- `LLMService`는 구성된 문자열을 `PromptVars.text`로 받아 생성된 캡션/포스트 카피를 반환합니다.

## `style_layers.yaml`
스타일 구성은 `apps/backend/src/modules/llm/config/style_layers.yaml`에 있으며 프로세스당 한 번 로드됩니다.

### 언어 별칭
- `language_aliases`는 페르소나 언어 코드(예: `en-US` → `en`)를 정규화합니다.
- 페르소나가 `language`를 생략하면 영어로 폴백합니다.

### 플랫폼 레이어
- `platforms.<platform>.<language>`는 채널별 지침을 정의합니다(영어로 작성됨).
- 누락된 언어 키는 `platforms.<platform>.default`로 폴백하고, 그 다음 `platforms.default.default`로 폴백합니다.

### 언어 블록
- `languages.default`는 공유 페르소나 지침(중립 음성, 톤 폴백, 페르소나 필드 템플릿)을 제공합니다.
- 언어별 재정의(`languages.ko` 등)는 톤 별칭, 스타일 가이드 wording 및 기타 언어별 뉘앙스를 조정합니다.
- 모든 지침은 제어 프롬프트의 일관성을 유지하기 위해 영어로 유지됩니다.

### 페르소나 필드 템플릿
- `persona_fields` 템플릿은 페르소나 속성(스타일 가이드, 기둥, 금지어 등)이 어떻게 포함되는지 설명합니다.
- 값은 형식화 전에 정규화됩니다(평탄화된 리스트, 중첩 객체에 대한 YAML 덤프).

### 퓨샷 예제
- `few_shots.<platform>.<language>`는 출력 언어로 예제 완성을 저장합니다.
- 선택 순서: 정확한 플랫폼+언어 → 플랫폼+`default` 언어 → `default` 플랫폼+언어 → `default`+`default`.
- 예제는 페르소나 섹션 내 `Example outputs in <LanguageLabel>:` 아래에 추가됩니다.

## 시스템 확장
1. **새 플랫폼 추가**
   - `platforms.<platform>.default` 지침을 제공합니다.
   - 같은 플랫폼 키 아래에서 특정 언어를 선택적으로 조정합니다.
   - `few_shots.<platform>.<language>`에 퓨샷 샘플을 추가합니다.
2. **새 언어 추가**
   - `language_aliases`에서 들어오는 코드를 매핑합니다.
   - 톤 별칭이나 페르소나 필드 wording을 재정의하는 `languages.<language>`를 생성합니다.
   - `few_shots.<platform>.<language>` 및/또는 `few_shots.default.<language>`에 현지화된 샘플을 제공합니다.
3. **새 페르소나 메타데이터 추가**
   - Persona 속성 이름을 위한 템플릿으로 `persona_fields`를 확장합니다.
   - 참조하기 전에 SQLAlchemy 모델에 필드가 존재하는지 확인합니다.

## 엣지 케이스 및 폴백
- 누락된 YAML 파일: StyleComposer는 레거시 하드코딩된 톤 규칙으로 폴백합니다.
- 알 수 없는 페르소나 톤: 별칭에서 톤을 유도하거나 `unknown_tone_label`로 폴백합니다.
- 잘못된 YAML 구조: 오류가 로깅되고 레거시 폴백이 사용됩니다.
- 조합에 대한 퓨샷 리스트 누락: 컴포저가 샘플을 정상적으로 건너뜁니다.

## 테스트 체크리스트
- `python3 -m compileall apps/backend/src/modules/llm/style_composer.py`를 실행하여 구문 문제를 포착합니다.
- 선택된 퓨샷 샘플과 지침을 확인하기 위해 페르소나/플랫폼 조합을 스모크 테스트합니다.
- 퓨샷 콘텐츠를 짧고 플랫폼별로 유지합니다. 내부 지침이나 PII 유출을 피합니다.

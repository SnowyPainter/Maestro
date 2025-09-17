# Maestro 오케스트레이션 시스템 아키텍처

이 문서는 Maestro 백엔드 시스템의 핵심인 오케스트레이션 아키텍처에 대해 설명합니다. 시스템이 사용자의 요청을 어떻게 이해하고, 계획을 세우며, 실행하는지에 대한 깊이 있는 이해를 돕는 것을 목표로 합니다.

## 1. 핵심 원칙: Orchestrator와 BFF

우리 시스템은 두 가지 주요 상호작용 패턴을 가집니다: **Orchestrator**와 **BFF(Backend for Frontend)**.

- **Orchestrator**: 복잡하고, 여러 단계가 필요하며, 자연어 이해가 요구되는 요청을 처리합니다. 사용자의 의도를 파악하여(NLP) 실행 계획(Plan)을 수립하고, 여러 내부 서비스(Operation)를 조율하여 과업을 완수합니다. 주로 `chat_router.py`를 통해 진입하는 채팅 기반의 상호작용이 여기에 해당합니다.

- **BFF**: 프론트엔드에 필요한 데이터를 미리 조합하고 가공하여 제공하는 역할에 집중합니다. 특정 UI 화면을 구성하기 위해 여러 소스에서 데이터를 가져와야 할 때, BFF는 이를 하나의 최적화된 API 호출로 묶어줍니다. `bff_router.py`와 `bff_*_router.py`들이 이 역할을 수행하며, 프론트엔드의 복잡도를 낮추고 성능을 향상시킵니다.

## 2. 주요 실행 흐름 (Orchestrator 중심)

자연어 요청이 처리되는 과정은 다음과 같습니다.

1.  **요청 입력 (`chat_router.py`)**: 사용자의 요청이 API 서버의 채팅 엔드포인트로 들어옵니다.

2.  **의도 분석 및 계획 수립 (`planner.py`)**: `Planner`는 `nlp.py`를 활용하여 사용자의 자연어 요청을 분석하고, 그 의도를 파악합니다. 이 의도를 달성하기 위해 필요한 **`Operation`**들의 순차적인 목록, 즉 **`Plan`**을 생성합니다.

3.  **`Operation` 조회 (`registry.py`)**: `Planner`가 생성한 `Plan`에 포함된 각 `Operation`은 단순한 문자열 이름입니다. 시스템은 이 `Operation` 이름에 해당하는 실제 실행 가능한 함수를 찾아야 합니다. 이 역할을 **`Registry`**가 담당합니다. `Registry`는 시스템이 시작될 때 `src/orchestrator/flows/` 내의 모든 `*_router.py` 파일을 스캔하여, `@router.get`, `@router.post` 등으로 정의된 모든 `Operation` 함수를 자신의 맵(dictionary)에 등록합니다.

4.  **`Operation` 실행 (`dispatch.py`)**: `Dispatch`는 `Planner`로부터 `Plan`을 전달받습니다. `Dispatch`는 `Plan`에 명시된 `Operation`들을 순서대로 실행합니다. 각 `Operation`을 실행할 때마다 `Registry`에 해당 `Operation` 이름으로 등록된 실제 함수를 조회하여 호출하고, 필요한 파라미터를 전달합니다.

5.  **결과 반환**: 모든 `Operation`이 성공적으로 실행되면, `Dispatch`는 최종 결과를 취합하여 사용자에게 반환합니다.

## 3. 주요 구성 요소 상세

- **Planner (`planner.py`)**: 오케스트레이션의 "두뇌"입니다. 자연어 요청을 실행 가능한 단계(Plan)로 변환하는 책임을 집니다.
- **Registry (`registry.py`)**: 오케스트레이션의 "전화번호부"입니다. 시스템 내에 존재하는 모든 `Operation`의 이름과 실제 함수를 매핑하여 보관합니다. 이를 통해 `Dispatch`는 `Operation`의 이름만으로 실제 기능을 호출할 수 있습니다.
- **Dispatch (`dispatch.py`)**: 오케스트레이션의 "실행기"입니다. `Planner`가 만든 계획을 받아 `Registry`를 통해 실제 함수를 찾아 순차적으로 실행하는 역할을 합니다.

## 4. `flows` 디렉토리의 역할

`src/orchestrator/flows/` 디렉토리는 **실행 가능한 `Operation`의 집합**을 정의하는 곳입니다.

- 각 `*_router.py` 파일은 특정 도메인(예: `accounts`, `campaigns`)과 관련된 `Operation`들을 그룹화합니다.
- FastAPI의 `APIRouter` 또는 `@FLOWS.flow` 데코레이터를 사용하여 각 `Operation`을 정의합니다.
- 시스템이 시작될 때, 여기에 정의된 모든 함수들이 자동으로 `Registry`에 등록되어 `Planner`와 `Dispatch`가 사용할 수 있는 `Operation`이 됩니다.
- 새로운 기능을 추가하려면, 이 디렉토리에 새로운 `*_router.py` 파일을 만들거나 기존 파일에 `Operation` 함수를 추가하고 `Registry`가 이를 발견하도록 하면 됩니다.

### 4.1 주요 Flow 파일 설명

| 파일명 | 설명 | 주요 Tags | 특징 |
|--------|------|-----------|------|
| `accounts_router.py` | 플랫폼 계정 및 페르소나 관리 | `accounts`, `platform`, `persona`, `social-media` | CRUD 작업, 계정 연결/해제 |
| `campaigns_router.py` | 마케팅 캠페인 관리 | `campaigns`, `marketing`, `kpi`, `analytics` | 캠페인 생성, KPI 관리, 성과 분석 |
| `drafts_router.py` | 콘텐츠 초안 관리 | `drafts`, `content`, `writing`, `editing` | 콘텐츠 생성 및 수정 |
| `insights_router.py` | 인사이트 데이터 처리 | `insights`, `data`, `analytics`, `ingestion` | 데이터 수집 및 분석 |
| `auth_router.py` | 사용자 인증 | `auth`, `authentication`, `security` | 로그인, 회원가입 |

### 4.2 BFF Flow 파일들

BFF(Backend for Frontend) 패턴을 사용하는 파일들은 프론트엔드에 최적화된 API를 제공합니다. 각 파일은 특정 UI 컴포넌트나 화면에 필요한 데이터를 효율적으로 제공하는 것을 목표로 합니다.

| BFF 파일명 | 설명 | 주요 Tags | UI 목적 |
|------------|------|-----------|---------|
| `bff_accounts_router.py` | 계정 및 페르소나 관리 UI를 위한 API | `bff`, `accounts`, `platform`, `persona`, `ui`, `frontend` | 계정 관리 인터페이스, 페르소나 설정, 플랫폼 연결 관리 |
| `bff_campaigns_router.py` | 캠페인 관리 대시보드를 위한 API | `bff`, `campaigns`, `kpi`, `metrics`, `dashboard`, `analytics` | 캠페인 모니터링, KPI 추적, 성과 분석 |
| `bff_drafts_router.py` | 콘텐츠 편집 및 관리를 위한 API | `bff`, `drafts`, `content`, `editing`, `variants` | 콘텐츠 작성 인터페이스, 초안 관리, 버전 컨트롤 |
| `bff_trends_router.py` | 트렌드 분석 대시보드를 위한 API | `bff`, `trends`, `analytics`, `insights`, `strategy` | 시장 분석, 콘텐츠 전략 수립, 트렌드 모니터링 |
| `bff_me_router.py` | 사용자 프로필 및 설정을 위한 API | `bff`, `me`, `user`, `profile`, `authentication` | 사용자 설정, 프로필 관리, 인증 상태 확인 |

이 파일들은 모두 `bff` 태그를 포함하며, 프론트엔드의 특정 UI 패턴에 최적화된 데이터 구조를 반환합니다. 일반적으로 읽기 전용 작업에 특화되어 있으며, 복잡한 데이터 조합이나 UI에 특화된 포맷팅을 수행합니다.

## 5. API 계약과 자동 생성의 관계

`contracts/openapi.yaml` 파일은 우리 시스템의 공식적인 API 명세(Contract)입니다.

`flows` 디렉토리에 정의된 `Operation`들은 이 `openapi.yaml`에 정의된 API 엔드포인트의 실제 구현체에 해당합니다. 즉, `openapi.yaml`이 "무엇을 할 수 있는지"를 정의한다면, `flows`의 라우터들은 "그것을 어떻게 할 것인지"를 실제로 구현합니다.

이러한 구조는 API 명세와 실제 구현 간의 일관성을 강제하고, `Registry`를 통한 동적 함수 발견 및 실행을 가능하게 하여 유연하고 확장 가능한 오케스트레이션 시스템을 구축하는 기반이 됩니다.

## 6. 참고: 관련 디렉토리 구조

```
/
├───contracts/
│   └───openapi.yaml
└───src/
    └───orchestrator/
        ├───bff_router.py           # bff_*_router 들의 path 별로 모아 /bff prefix 라우팅
        ├───chat_router.py          # 사용자 자연의 질의 단일 창구
        ├───dispatch.py             # 런타임 콘텍스트 관리
        ├───nlp.py                  # 레지스트리 기반 자동 룰 생성 - 확정적인 인덴트
        ├───planner.py              # 정의된 플로우 기반 와이어링 + 추론 기반 즉석 DSL 체인
        ├───registry.py             # 결정론적인 Flow 데코레이터
        └───flows/
            ├───accounts_router.py
            ├───auth_router.py
            ├───bff_accounts_router.py
            ├───bff_campaigns_router.py
            ├───bff_drafts_router.py
            ├───bff_me_router.py
            ├───bff_trends_router.py
            ├───campaigns_router.py
            ├───drafts_router.py
            └───insights_router.py
```
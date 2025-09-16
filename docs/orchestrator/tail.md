# Orchestrator 설계 문서

## 조건 정의

각 도메인 모듈의 service.py와 Celery shared_task가 실제 로직 담당.

BFF 라우터는 얇은 READ 전용, Orchestrator 라우터는 WRITE/복합 플로우 전용.

모든 라우터는 최소한의 파라미터 전달·검증만 하고, 비즈니스는 서비스로 위임.

## 문제 정의

사용자는 REST API로 단일 작업을 직접 실행할 수도 있어야 하고,

동시에 **자연어 질의(Chat)**로 다단계 플로우를 실행할 수도 있어야 한다.

자연어 질의는 행위 지시 / 콘텐츠 지침 / 정보 조회 3개 Intent로 분류되며, 섞여서 올 수 있다.

## 해결

Orchestrator를 단일 실행 엔진으로 두고, 모든 작업을 Operator로 모듈화한다.

REST와 Chat 모두 같은 Executor/Registry를 쓴다.

- **REST**: 단일 READ는 BFF 유지, CREATE/UPDATE/복합 플로우는 `/orchestrator/execute`에서 DAG 제출.
- **Chat**: Planner가 Intent 분류 → 슬롯 추출 → 템플릿 DAG 선택/합성 → CTX 주입 → Executor 실행.

## 레지스트리

`@register("drafts.create", "1.0.0")` 같은 데코레이터로 Operator 등록.

오토디스커버리(import scan)로 Registry에 자동 추가.

Operator는 `in_model`, `out_model`을 가진다 → DAG 합성 시 타입/스키마 검증 가능.

## 결정론적 플랜 (DSL)

DAG 스펙은 JSON/Pydantic으로 표현.

같은 DSL + 같은 Operator 버전 + 같은 입력이면 항상 같은 결과.

canonical DSL JSON hash를 저장해 재현성 확보.

## 합성 (Operator < DSL 템플릿 < DSL 확장)

- **Operator** = 원자 실행 단위.
- **DSL 템플릿** = 자주 쓰는 오퍼레이터 조합.
- **DSL 확장** = 여러 템플릿을 합쳐 새 DAG 생성.

### 문제
오퍼레이터 out/in 타입이 불일치하면 단순히 붙일 수 없음.

### 해결
Adapter/Transformer 오퍼레이터를 자동으로 삽입하거나, Planner가 합성 시점에 추가.

## 목표

"단순 오퍼레이터 콜"부터 "복합 DAG 합성"까지 하나의 엔진에서 결정론적으로 실행 가능.

REST든 Chat이든 같은 Operator Registry와 Executor를 거치므로 로직 일관성이 보장됨.
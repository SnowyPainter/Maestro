# Reactive Flow 계획 (단순화 버전)

## 1. 목표
- `insight_comments`를 CoWorker가 주기적으로 가져와(내 계정이 단 댓글은 제외) 즉시 DM/댓글/Alert 태스크를 실행한다.
- 운영자는 `ReactionRule`로 키워드→태그, 태그→템플릿/알림 매핑만 정의하고, Post Publication과 룰을 연결해 재사용한다.
- 태그별 행동은 템플릿 유무에 따라 선택적으로 실행되므로 필요한 액션만 수행한다.

## 2. End-to-End 흐름
1. **Ingest**  
   - Celery Beat → CoWorker 작업이 5분 간격으로 `insight_comments`에서 새 댓글을 조회한다.  
   - `is_owned_by_me = true` 댓글은 즉시 제외한다.
2. **룰 탐색**  
   - 댓글의 `post_publication_id`에 연결된 ReactionRule들을 로드한다.
3. **키워드 매칭 → 태그 생성**  
   - 룰에 정의된 키워드/패턴과 댓글 텍스트를 비교해 태그 세트를 만든다. (룰 기반, ML 사용 없음)
4. **태그별 액션 결정**  
   - 태그마다 대응되는 템플릿/알림 설정을 확인한다.
   - DM 템플릿 있으면 DM 발송 태스크 enque, Reply 템플릿 있으면 댓글 응답 태스크 enque, Alert 설정이 true면 Alert 태스크 enque.
5. **태스크 실행**  
   - CoWorker 워커가 DM/Reply/Alert 태스크를 처리해 API 호출 또는 Alert 기록을 수행한다.
6. **로그 및 중복 방지**  
   - 실행 결과는 로그 테이블에 기록해 재시도/중복 실행을 방지한다.

## 3. ReactionRule 설계
- **구성 요소**
  1. **Keyword→Tag 매핑**  
     - 키워드(정규식/문자열/해시태그 등) 리스트를 태그에 매핑한다.  
     - 하나의 룰이 여러 태그를 정의할 수 있으며, 태그 우선순위를 옵션으로 둔다.
  2. **Tag→Action 매핑**  
     - 태그마다 DM 템플릿 ID, Reply 템플릿 ID, Alert 사용 여부를 정의한다.  
     - 템플릿 ID가 없으면 해당 액션은 건너뛴다.  
     - Alert가 true면 알림 태스크에 필요한 세부 설정(심각도, 담당자)을 함께 저장할 수 있다.
- **Post Publication 연결**
  - 하나의 ReactionRule은 여러 Post Publication에 연결될 수 있고, 반대로 하나의 Post Publication이 여러 룰을 참조할 수 있다(다대다).
  - 연결 정보에는 활성화 기간과 우선순위를 포함해 충돌 시 어떤 룰이 먼저 적용될지 명시한다.

## 4. 템플릿 & 실행 전략
- **DM / Reply 템플릿**
  - 기존 메시지 템플릿 시스템(`comment_response_templates` 등)에 저장하고 ID로 참조.
  - 필요할 경우 태그별 LLM 사용 옵션을 두어 “템플릿 + LLM 프롬프트” 조합도 설정 가능. (예: `mode = TEMPLATE_ONLY | TEMPLATE_WITH_LLM_AUGMENT`)
- **Alert 처리**
  - Alert 태스크는 `alerts`(혹은 신설 테이블)에 레코드를 생성하고, 슬랙/이메일 등 사내 알림 채널로 전달하도록 CoWorker 작업이 확장된다.
- **재시도/중복 제어**
  - 동일 댓글, 동일 태그, 동일 액션 조합이 일정 기간 내 중복 실행되지 않도록 `reaction_action_logs`에서 상태를 확인한 후 enqueue.

## 5. 최소 데이터 모델
1. `reaction_rules`  
   - `id`, `owner_user_id`, `name`, `description`, `status`, `priority`, `created_at`, `updated_at`.
2. `reaction_rule_keywords`  
   - `id`, `reaction_rule_id`, `tag_key`, `match_type`(exact/regex/contains), `keyword`, `language`, `active`.  
   - 인덱스: `(reaction_rule_id, tag_key)` / `(keyword, match_type)`.
3. `reaction_rule_actions`  
   - `id`, `reaction_rule_id`, `tag_key`, `dm_template_id`, `reply_template_id`, `alert_enabled`, `alert_severity`, `alert_assignee_id`, `llm_mode`, `metadata`(JSON).  
   - 인덱스: `(reaction_rule_id, tag_key)`.
4. `reaction_rule_publications`  
   - `id`, `reaction_rule_id`, `post_publication_id`, `priority`, `active_from`, `active_until`.  
   - 인덱스: `(post_publication_id, active_until)`.
5. `reaction_action_logs`  
   - `id`, `insight_comment_id`, `reaction_rule_id`, `tag_key`, `action_type`(DM/REPLY/ALERT), `status`, `payload`(JSON), `error`, `executed_at`, `created_at`.  
   - Unique 제약: `(insight_comment_id, tag_key, action_type)`로 중복 실행 방지.
6. (선택) `reaction_alerts`  
   - Alert 태스크가 생성한 항목을 보관. `alerts` 모듈이 별도로 있다면 재사용하거나 조인만 추가.

## 6. 구현 단계 로드맵
1. **기본 워크플로 완성**  
   - CoWorker ingest 작업에서 댓글을 가져와 룰 조회, 태그 평가, 태스크 enqueue까지 연결.
2. **룰/템플릿 CRUD**  
   - Admin 혹은 콘솔 화면에서 ReactionRule과 키워드, 액션 템플릿을 설정할 수 있는 UI/API 구축.
3. **Post Publication 연결 관리**  
   - 게시글 선택 후 원하는 룰을 매핑할 수 있는 인터페이스 제공.
4. **태스크 실행기**  
   - DM 발송, 댓글 작성, Alert 기록용 CoWorker 태스크 구현.  
   - 기존 메시지 템플릿 시스템을 재사용하거나 필요한 경우 신규 템플릿 타입 추가.
5. **로그 & 모니터링**  
   - `reaction_action_logs`를 기반으로 성공/실패/건너뛰기 현황을 대시보드에 노출.  
   - Alert 파이프라인 연동(슬랙, 이메일 등).
6. **고급 옵션(선택)**  
   - 태그 우선순위, LLM 보조 응답, 시간대별 제한, 사용자별 rate-limit 등을 확장.

## 7. 운영 전략
- **버전 관리**: 룰 수정 시 변경 이력 저장 후 롤백 가능하도록 한다.
- **검증 절차**: 룰 저장 시 테스트 모드에서 샘플 댓글과 매칭 결과를 미리 보여주어 오작동 방지.
- **모니터링**: Alert 남발 또는 응답 실패 시 빠르게 대응할 수 있도록 알림 SLA를 정의.
- **컴플라이언스**: DM 발송 횟수, 시간대 제약은 태스크 실행 단에서 공통 정책을 체크한다.
- **Fail-safe**: 댓글 삭제, API 오류 발생 시 `reaction_action_logs`에 상태를 기록하고 재시도 정책을 적용한다.

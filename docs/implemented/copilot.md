# Graph RAG Copilot — 동작 요약과 개선 로드맵

## 현재 동작
- **제안 API**: `/graph-rag/suggest` 및 quickstart/memory/next-action 변형이 공통 플로우를 통해 컨텍스트 수집 → Graph RAG 검색 → 카드 우선순위 산정 → `GraphRagSuggestionResponse` 반환.
- **카드 섹션**  
  - Trend: 추격 초안용 템플릿(CTA: trend→draft).  
  - Draft/Next Action: 그래프 엣지 기반 “계획” 텍스트(CTA 없음, Plan only).  
  - Playbook: 메모리/재사용 하이라이트(CTA: playbook_reapply).  
  - ROI 스냅샷: 재사용·자동화 집계 기반.
- **실행 플로우**  
  - `graph_rag.actions.trend_to_draft`: PromptRegistry `draft.from_trend` LLM 호출 → Draft 생성(LLM 실패 시 마크다운 폴백) → playbook 이벤트 기록 → 그래프 리프레시.  
  - `graph_rag.actions.playbook_reapply`: 재사용 이벤트 기록, persona/campaign 역채움 → 커밋 → 리프레시.  
  - `graph_rag.actions.next_action`: 선택 로그만 기록(부작용 없음) → 리프레시.
- **결과 스키마**: `GraphRagActionResult`가 intent, inputs/outputs, reason, confidence, timing_ms, refresh 대상, audit(LLM 사용), dedupe_signature를 포함. ActionAck에서 모두 노출.
- **프런트 UX**: CopilotCard는 automatable 카드만 CTA를 노출하고, Next Action은 “Plan only” 배지로 수동 검토용 표시. ActionAck는 입력/출력/감사 메타/소요시간을 시각화.

## 현재 ROI 계산 (`estimate_roi`)
- 입력: memory_highlights, next_actions, persona_ctx.
- 절차:
  - 재사용 횟수 합계와 자동화 개수 집계.
  - 채널/액션 가중치: paid 1.5, longform 1.2, shortform 0.8, comment 0.6(메타에서 channel/kind 추정, 기본 1.0).
  - 시간 절감 추정:  
    - 재사용: 5분 × reuse_count × 채널 가중치.  
    - 자동화: (10분 + confidence×5) × 채널 가중치.  
  - saved_minutes를 반올림하여 반환하고, AI介入률(ai_rate)을 자동화 기여분/총 효과로 계산.
- 반환: `RagValueInsight(memory_reuse_count, automated_decisions, saved_minutes, ai_intervention_rate, persona)`.
- 한계: 비용/채널 단가, 콘텐츠 성과(도달/반응), 리스크/불확실성은 미포함.

## 한계
- Next Action은 실행 불가(텍스트 계획)라 자동화와 분리가 필요.
- 근거(소스 노드/엣지, score, suggested_at) UI 노출이 부족.
- ROI가 시간 절감 위주로 단순하며 비용/성과/리스크 모델이 없다.
- 자동화 가능한 액션 세트가 제한적(트렌드→드래프트, 플레이북 재사용).

## 개선 로드맵
1) **액션 타입 정규화**  
   - Plan(next_action)은 그대로 두되, 자동화 가능 액션을 enum+필수 파라미터로 분리(`draft_from_trend`, `playbook_reuse`, `schedule_post`, `reply_comment` 등). CTA는 자동화 타입에만 노출.
2) **근거 노출**  
   - 카드/ACK에 `meta.source_node_id`, 엣지 타입, score, suggested_at을 표준화해 “왜 이 제안인가”를 명시.
3) **워크플로 확장**  
   - 스케줄/댓글 응답 등 실행 플로우 추가, playbook/worker에 연결. dedupe_signature로 멱등/중복 방지.
4) **랭킹/필터**  
   - 최신성+엣지 강도+완료 여부 기반 priority, “자동화만 보기/계획 보기” 토글.
5) **관측성**  
   - 추천 후보/필터링 수, 실행 성공률, 리프레시 지연을 로깅·계측해 UI/모니터링에 반영.
6) **ROI 고도화**  
   - 추가 변수: `cost_savings`(채널별 시간·매체비), `content_lift`(도달/반응률 개선), `risk_score`(품질·규칙 위반 리스크), `confidence_interval`.  
   - 예시 모델: `saved_minutes = reuse*5 + automations*10`; `cost_savings = saved_minutes * blended_hourly_rate`; `content_lift = baseline_reach * lift_factor_by_channel`; `roi_score = w1*cost_savings + w2*content_lift - w3*risk_score`.  
   - 데이터 필요: 채널 단가/평균 도달, 액션 성공률 히스토리, 휴먼 리뷰 시간, 리스크 로그(품질/규칙 위반).

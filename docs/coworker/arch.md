# CoWorker 구성안 (정리본)

## 1. 스케줄러

* **스케줄 테이블**을 단일 진입점으로 사용.
* 30초마다 스캔 → due 항목을 큐에 enqueue.
* 모든 예약성 작업을 여기로 환원:

  * Default Job: PostPublication은 맨날 봐야함(스케쥴)
  * 발행 / 삭제 (Adapter 태스크 호출)
  * 메트릭 수집(InsightSample)
  * 댓글 모니터링 / 상호작용
  * 이메일 발송
  * 트렌드 기반 Draft 생성 루프
* 정책화:

  * PersonaAccount 단위로만 동작 (없으면 무효).
  * 사용자도 직접 스케줄에 개입 가능 (화이트보드 UX).
  * 댓글 인터랙션은 정책/랜덤 배치로 “자연스러움” 확보.

## 2. 워커 종류

* **이메일 워커**

  * 지침/발행/모니터링 결과를 이메일로 전달.
  * 발행 직전 알림 → 무시/취소 옵션 제공.

* **코어 상호작용 워커** (별도 네이밍 불필요)

  * Sniffer 결과와 Persona 유사도 기반 Draft 생성.
  * 회신 시 DraftIR 확정 → 컴파일 → PostPublication upsert.
  * 댓글 정책(QnA) 기반 자동응답.
  
* **집계 워커** (역시 별도 네이밍 불필요)

  * 일일 KPI 집계.
  * 댓글 동향 집계.
  * 이메일/타임라인 이벤트로 전송.

## 3. 엔티티/피처

* **PostPublication** = 모든 발행/삭제/모니터링의 단일 SoT.
* **Schedule** = 예약성 행위의 SoT.
* **타임라인 뷰** = 시간축 이벤트 통합. 필터링으로 Draft/Publication/Insight/KPI/댓글 상호작용/CoWorker 액션 전부 노출.
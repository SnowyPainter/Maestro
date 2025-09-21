# 구성안

DraftVariant: Ready for Post 토글(PostPublication Pending/Cancelled Upsert)

## CoWorker 스케쥴러

- 스케쥴 테이블 30초 간격으로 스캔 - due 항목 enqueue
    - 이렇게 함으로써 얻는 이득: 모든 모니터링 스케쥴을 이것으로 환원하기에, 변동가능성있는 고정스키마 존재하지 않음.
    - 모니터링 스케쥴: 사용자는(추후 결제 등 정책에 따라) 최대 n개의 모니터링 가능, interval은 1시간 고정, 잘 배분분
- Sniffer 트렌딩 긁어오는 interval마다 벡터스토어 스캔
- 댓글 모니터링 -> 적절한 워커, n시간 마다.

## CoWorker 워커

- 이메일 워커

- 각 어댑터들의 publish / delete / sync_metrics
    - SoT : PostPublication

- Interactor
    - User단위가 아니라 PersonaAccount 별로 수행
    - **Campaign**과 벡터유사도 비슷한게 있으면 Draft 생성 후 메일 -> 회신시 최종 DraftIR 생성 -> 컴파일 -> 결과 메일
    - 예약된 발행 취소/그대로진행(무시)
    - 정해진 댓글 상호작용, 준비한 QNA에 따라 댓글 자동 답변

- Sonar
    - 캠페인 KPI 집계 일일 보고 -> 이메일 워커
    - 댓글 동향 집계 보고 -> 이메일 워커
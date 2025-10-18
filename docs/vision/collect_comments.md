# 댓글 수집

* internal.insights.sync_metrics 에서 메트릭과 댓글을 동시에 수집한다.
* schedule 템플릿 중 ScheduleTemplateKey.INSIGHTS_SYNC_METRICS 이 스케쥴 대상이 될 수 있으며,
이 템플릿 내부에서 internal.insights.sync_metrics를 쓴다. 고로 수집된다.

## 영향

* 댓글은 사용자가 모니터링할 때 마다 수집된다.
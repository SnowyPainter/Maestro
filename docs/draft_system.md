## 1. 핵심 엔티티 흐름

* **Draft**: IR(중간표현) 저장, 캠페인에 속할 수도 있음
* **DraftVariant**: Draft → 플랫폼별 렌더링 결과 (계정 무관)
* **PostPublication**: 실제 계정에 발행되는 퍼블리시 기록 (CoWorker가 관리)
* **InsightSample**: 외부 플랫폼에서 수집한 모니터링 데이터 (메트릭/스냅샷)

## 2. 동작 플로우

1. 사용자가 Draft 작성 (공통 IR)
2. Draft → Variant 컴파일 (플랫폼 제약 검증/렌더링)
3. 발행 요청 시 → PostPublication 생성 (계정 + Variant)
4. CoWorker가 PostPublication 실행 → 플랫폼 Adapter 통해 실제 발행
5. 이후 모니터링 이벤트 → InsightSample 적재 (publication\_id 연결)

---

* **Draft = IR 중심 원본**
* **Variant = 플랫폼 단위 렌더링 결과**
* **PostPublication = 실제 계정 발행 단위 (CoWorker 담당)**
* **InsightSample = 모니터링 시점별 메트릭**
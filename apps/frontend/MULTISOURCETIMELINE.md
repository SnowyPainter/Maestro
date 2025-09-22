## 멀티-소스 타임라인 UX 원칙

### 1. **단일 시간 축, 다중 소스 레이어**

* **시간은 절대적 기준** → 중앙 축(세로 혹은 가로)에 고정.
* 소스(Post, KPI, Trend 등)는 **병렬 레이어**나 \*\*행(row)\*\*으로 배치.
* 즉, **“시간=공통 분모, 소스=차원”**.

### 2. **집약 + 확장 (Aggregate & Expand)**

* 같은 시간대에 이벤트가 몰리면:

  * 대표 아이콘 + `n+` 뱃지 → **요약 뷰**
  * hover / click → **풀 리스트 팝오버**
* 이렇게 하면 clutter를 피하면서도 설명력을 유지.

### 3. **아이콘 중심 시각 언어**

* 각 소스는 **고유한 아이콘/컬러**로 표현.

  * Draft / Schedule / KPI / Trend …
* “이 아이콘만 봐도 출처/의미를 인식” → 학습 곡선 ↓

### 4. **상태 전이 시각화**

* 동일한 `event_id`는 **progressive state**로 연결:
  * 예: `draft.created → draft.scheduled → publish.done/failed`
* UI에서 **아이콘/배지 색상 변화 + 연결 라인**으로 표현.
* GitHub Actions / Linear의 “status pipeline”과 유사.

### 5. **계층적 정보 구조**

* **Top level**: 시간 + 아이콘 요약
* **Hover / Click**: 상세 카드 (설명, 로그, KPI 그래프 등)
* **Drill-down** 구조로 정보 밀도 조절.

---

## 🎨 비주얼 패턴 예시

* **세로축 타임라인 + 행별 소스**

  ```
  09:00 | 📄 Draft (3)       | 📊 KPI (2)   | 🔎 Trend
  12:00 | 📅 Schedule (1)   |              | 🔎 Trend (5)
  15:00 | 🚀 Publish (OK)   | 📊 KPI (+5%) | 
  ```
* **중앙 축 + 양쪽 레이어** (좌=시스템 이벤트, 우=성과/트렌드)

  * LinkedIn 활동 로그 + Jira 이슈 히스토리 결합 느낌.

---

## 🧩 UX 철학 요약

1. **시간 = 단일 기준, 소스 = 다중 레이어**
2. **아이콘 + 색상 → 즉시 출처 인식**
3. **같은 시간대 이벤트 = 집약 뷰 → 확장 가능**
4. **상태 변화는 연결 라인 + 색상 전이로 명확히**
5. **Top-down 정보 밀도: 요약 → 상세 카드**

## Data 예시

```
{
  "source": "composed",
  "events": [
    {
      "event_id": "post_publication:7:created",
      "persona_account_id": 2,
      "source": "post_publication",
      "kind": "post_publication.lifecycle",
      "timestamp": "2025-09-21T23:41:34.771705Z",
      "status": "pending",
      "payload": {
        "phase_source": "post_publication",
        "post_publication": {
          "id": 7,
          "variant_id": 73,
          "account_persona_id": 2,
          "platform": "threads",
          "external_id": null,
          "permalink": null,
          "status": "scheduled",
          "scheduled_at": "2025-09-24T08:55:00Z",
          "published_at": null,
          "deleted_at": null,
          "monitoring_started_at": null,
          "monitoring_ended_at": null,
          "last_polled_at": null,
          "errors": null,
          "warnings": null,
          "meta": null,
          "created_at": "2025-09-21T23:41:34.771705Z",
          "updated_at": "2025-09-21T23:55:40.895227Z"
        },
        "phase": "created",
        "status": "scheduled"
      },
      "operators": [
        "bff.timeline.post_publications"
      ],
      "correlation_keys": {
        "post_publication_id": "7",
        "variant_id": "73",
        "platform": "threads"
      },
      "origin_flow": "bff.timeline.post_publications"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399662+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399662Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 742,
          "country": "US",
          "rank": 1,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "mbx stock",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcStxljdVZS-4279F0s5gCYJYoGe4dv9kmhJgDr7BCxbqZpR8ksAWofL3KGGGak",
          "picture_source": "STAT"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399692+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399692Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 745,
          "country": "US",
          "rank": 2,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "wordle hints",
          "approx_traffic": "2000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQlUoiTeuhEQ6VfxX51p8COsWB1xoaHx-tlblFO4lxwyWBR4RqhMi9m49_22eo",
          "picture_source": "The New York Times"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399698+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399698Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 747,
          "country": "US",
          "rank": 3,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "glenn close",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPUcu6t-1knsjQEO9vd5muh-42lQ20-k8pTJLibLVTvBXoqvU5ZDH4Bsw35Hw",
          "picture_source": "The New York Times"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399703+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399703Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 750,
          "country": "US",
          "rank": 4,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "srini gopalan",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcTUOheIogdK-83oRU0vICluDz2Z6O7gkNSfkxPVKYLcLSn1P41DoPWUrSvx1Is",
          "picture_source": "Yahoo Finance"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399707+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399707Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 753,
          "country": "US",
          "rank": 5,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "agri stock",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcS4mqrJciUM1R5SCedq3gxF5mB-O5Sqt265uFqLbrhR7P-10ZLJI-xdo_3o5A",
          "picture_source": "Yahoo Finance"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399712+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399712Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 755,
          "country": "US",
          "rank": 6,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "alexander bublik",
          "approx_traffic": "1000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRJ4n0g9AY2m8xm7LP_wrmM6fZOR2bMZCv0rrSw6W68KVzi9U9qehvoaVfc5gY",
          "picture_source": "ATP Tour"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399716+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399716Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 757,
          "country": "US",
          "rank": 7,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "iren stock",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcR4HGMIeR9q1IFSoO1phN3J_rcs8k5Xs8O3y4FyRko6mh3L2fLYzARglfBbDiM",
          "picture_source": "Yahoo Finance"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399720+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399720Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 758,
          "country": "US",
          "rank": 8,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "fortnite reel secret code instagram",
          "approx_traffic": "1000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcT4TcZb_fdVHzhqm8GjP964NtZ2usjSobFpBsMTwhr9nVodwroDCURn2_ET0Dg",
          "picture_source": "Game Rant"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399724+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399724Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 759,
          "country": "US",
          "rank": 9,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "nashville weather",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRr7e-lECLNs_d4PxRYEu__BPY65pEZCIe7q-33dZziYM75Enfs4i4xsFXKH3g",
          "picture_source": "WMUR"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399728+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399728Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 760,
          "country": "US",
          "rank": 10,
          "retrieved": "2025-09-22T21:17:05Z",
          "title": "ny rangers",
          "approx_traffic": "2000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQuYwYUD_WOKvQjRS5EN_70-If4owigmGgNEMDIMlduT6G6VWREVhMptwNqfAY",
          "picture_source": "NHL.com"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399733+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399733Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 701,
          "country": "US",
          "rank": 1,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "anywhere real estate",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRAbLyowegblpMH7Ge9zsWP3DYO3PXU9n258ffX4I2zz0Oa5CYjyreRW5fC4bY",
          "picture_source": "The Wall Street Journal"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399737+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399737Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 702,
          "country": "US",
          "rank": 2,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "adam sandler",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_ufaFqLIrQMcS5D28lkMUuCXgvr55upbtZPGzr67Gp23YT65sMdpkLHG9YJ4",
          "picture_source": "Parade Magazine"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399741+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399741Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 703,
          "country": "US",
          "rank": 3,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "ionq stock",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnb2f4oxX3G0WYG_N8eBRU7U-gvMyJSM6k4v35pWDZ-cJ6MYZnJlfIKovHEBQ",
          "picture_source": "Yahoo Finance"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399745+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399745Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 704,
          "country": "US",
          "rank": 4,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "thalha jubair",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSHWIMj4ah8vA8HZ9VNBSe8xA9vj-1XGqtwBwt2aLCqi13L3pL92XCmC3INqiM",
          "picture_source": "National Crime Agency"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399749+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399749Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 705,
          "country": "US",
          "rank": 5,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "byd stock",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRLTaszc1ShhMiG_ROcl1IjbcsrrmaeKLi7TTViyiCJpzpI5xXFZ7fZDshe0R0",
          "picture_source": "CNBC"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399752+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399752Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 706,
          "country": "US",
          "rank": 6,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "mta",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcReT5Pr4_EsM4y-3aGNMMFsyob9ejkzRFrUmKC7OEfkQVcFZJCzAJdyIMgOitc",
          "picture_source": "THE CITY - NYC News"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399756+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399756Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 707,
          "country": "US",
          "rank": 7,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "weei",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQkCKselsxeSCEheRwDKvPcShw4tLxdP3eMRojVORofs3nDzFRM8NcLYieVhYs",
          "picture_source": "Audacy"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399760+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399760Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 708,
          "country": "US",
          "rank": 8,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "lorenzo musetti",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRjQYI3j_LpOg8xqd1n7D9HG9Vseyd6xES4k-wcPrMbYA_dR4wCwq_MaftT8_o",
          "picture_source": "ATP Tour"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399764+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399764Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 709,
          "country": "US",
          "rank": 9,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "metsera",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQjqVK7dpYD8loLHXauUAzSKEnd8PF2gYqA4xEyidKw3ogNfKg303BPGAB2mi0",
          "picture_source": "Reuters"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399768+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399768Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 710,
          "country": "US",
          "rank": 10,
          "retrieved": "2025-09-22T20:17:01Z",
          "title": "flash flood warning",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSlVkznMZho9N18dtOxfvr6g2gAGpf6wPpkjbE5nGMKZCypFjBlKhfJ8xyEN8k",
          "picture_source": "Fort Worth Star-Telegram"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399771+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399771Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 641,
          "country": "US",
          "rank": 1,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "bay area news",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQxACoN8qVBmNPE-N93tum-VRyCd0vS1jrTpp3Fm6TSaPectHGevjU0erJcBVU",
          "picture_source": "SFGATE"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399775+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399775Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 642,
          "country": "US",
          "rank": 2,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "berkeley",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcT4itiM3vXDt_FUfE9z9s4wpeNrcLwSRsccIo5MgxZEsl8J29MY0BSrnth0Djk",
          "picture_source": "Politico"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399779+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399779Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 643,
          "country": "US",
          "rank": 3,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "ktvu",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRKhjIaCrD38SLbrRiu5JpYiDO5CeDOU5iN5wiT_nDu_Kk_LGjxgr1hTjWBqjc",
          "picture_source": "SFGATE"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399783+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399783Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 644,
          "country": "US",
          "rank": 4,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "nicolás maduro",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQSqrMswvLiAoD-y582qusMdNymeSQTaBJ3cd7DtP2T38190mYJTBkwIJ16FHA",
          "picture_source": "San Francisco Chronicle"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399840+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399840Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 645,
          "country": "US",
          "rank": 5,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "local news",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRgBBAviGIcUn4P6V4cuv7fXniDtyQH-Cp-Kw8pEo2kRE891XYLG468rcpipBM",
          "picture_source": "Green Bay Press-Gazette"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399849+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399849Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 646,
          "country": "US",
          "rank": 6,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "nextdoor",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkpXwzC5l2WwL6wYmyLkqds1lowbladHFLGRhXawNglUpiCsHp79uAVAc9O7k",
          "picture_source": "Toronto Star"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399855+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399855Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 647,
          "country": "US",
          "rank": 7,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "rgti stock",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQQh-DPKg1lQpt7qzJkxXH8HouNodsMuFO5PL08C6WMLtq0F0jCjiPYwR6wMeY",
          "picture_source": "Yahoo Finance"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399860+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399860Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 648,
          "country": "US",
          "rank": 8,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "noaa weather",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTR2uQh7a9yjsvNose5w6F7UcTBa_ZQ8ODeLb8UwoFbBzYycrLCVHojxaWLAPE",
          "picture_source": "SpaceX"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399865+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399865Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 650,
          "country": "US",
          "rank": 9,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "earthquake",
          "approx_traffic": "50000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYngA7j8ErMAUzEYpKK2EK8Vu-RJwYkkFfH3iOicyoIDk2_yjiNHwKv_uSMbA",
          "picture_source": "Travel And Tour World"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399869+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399869Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 653,
          "country": "US",
          "rank": 10,
          "retrieved": "2025-09-22T19:16:56Z",
          "title": "earthquake near me",
          "approx_traffic": "20000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQym9V4XIZz0smZXB1JyCIofu5sKqAjPnW_x9KnsJFH7ThvtRuodtvb3QhP56s",
          "picture_source": "eKathimerini.com"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399873+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399873Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 621,
          "country": "US",
          "rank": 1,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "goldie hawn",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcSZoNEyJJl0vSF2jP6WIwZHv-_USogjxtJ3D51dfwLtgdUZ9VxMsS3UHpBRgGI",
          "picture_source": "Women.com"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399877+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399877Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 622,
          "country": "US",
          "rank": 2,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "byu cougars football",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcREdaW65nc0usCs_VTk_cY71qI6HyFNGSZfWlDoUDntaB8QXSqQz850j0oTjUE",
          "picture_source": "ESPN"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399882+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399882Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 623,
          "country": "US",
          "rank": 3,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "russell westbrook",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRIj_T01Oe6m8KXJl-rfTSV6hmeLGqUK1RrLDbwFnzwCSKwI3zUPuEnSxj1Nv4",
          "picture_source": "NBA Analysis Network"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399887+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399887Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 624,
          "country": "US",
          "rank": 4,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "brandon nakashima",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfsu4Q6VDpG0ePyMqec2bpfl1WAivVTGneHJtBz3HwXNfMookwwApiFPuO-f0",
          "picture_source": "The Grandstand"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399892+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399892Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 625,
          "country": "US",
          "rank": 5,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "new zealand",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRoJAM2yfU1AwmAWQkzKOHLjrlArQdJk6eHdyakj93z9B1QSLgJ95jCCN_AEdM",
          "picture_source": "The Trots"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399897+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399897Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 627,
          "country": "US",
          "rank": 6,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "aaron taylor johnson",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQ4vlJDB0swuqhJpsfOX4C9-D5P9UTNSL5RgXx6JDoE9SOdVgK-ZbQUw5J8M7I",
          "picture_source": "Collider"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399902+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399902Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 628,
          "country": "US",
          "rank": 7,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "mini crossword answers",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6dlqb0-7MPSs9LEoefcikvGXRPrS-jKQvk-WpbX9uRYYGF_mDv16qAbK8FFE",
          "picture_source": "The New York Times"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399906+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399906Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 630,
          "country": "US",
          "rank": 8,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "air canada",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcSgYeEmI2eGld7K8YhRXf_edt73XOPvLTYugTvVG_jeODuY-Ws3keAMN_QDR3E",
          "picture_source": "Simple Flying"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399911+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399911Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 632,
          "country": "US",
          "rank": 9,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "台风",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxjTtPAKHUZ9tYTDopLzNhlseSnXCvfF61XXRsTx1ggLIs1X50CrPz3K7_q0",
          "picture_source": "凤凰网"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399916+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399916Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 636,
          "country": "US",
          "rank": 10,
          "retrieved": "2025-09-22T18:16:51Z",
          "title": "veronika erjavec",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDuYtshAdJfLPkBdalN1hbpVG7l_pcJsWRYIFv0-Xe-RfgR4DkLyoGVXrKPkk",
          "picture_source": "Delo.si"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399920+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399920Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 566,
          "country": "US",
          "rank": 1,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "mini crossword answers",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6dlqb0-7MPSs9LEoefcikvGXRPrS-jKQvk-WpbX9uRYYGF_mDv16qAbK8FFE",
          "picture_source": "The New York Times"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399924+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399924Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 573,
          "country": "US",
          "rank": 2,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "air canada",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcSgYeEmI2eGld7K8YhRXf_edt73XOPvLTYugTvVG_jeODuY-Ws3keAMN_QDR3E",
          "picture_source": "Simple Flying"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399928+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399928Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 576,
          "country": "US",
          "rank": 3,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "eth price",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQJyFOEBDlFEn6RCn37vHVe0wcGXcDhfzRauRvVOacGC_r81GINrLHKN7sNWFg",
          "picture_source": "TradingView"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399933+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399933Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 579,
          "country": "US",
          "rank": 4,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "台风",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxjTtPAKHUZ9tYTDopLzNhlseSnXCvfF61XXRsTx1ggLIs1X50CrPz3K7_q0",
          "picture_source": "凤凰网"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399937+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399937Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 582,
          "country": "US",
          "rank": 5,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "veronika erjavec",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDuYtshAdJfLPkBdalN1hbpVG7l_pcJsWRYIFv0-Xe-RfgR4DkLyoGVXrKPkk",
          "picture_source": "Delo.si"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399942+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399942Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 584,
          "country": "US",
          "rank": 6,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "btc price",
          "approx_traffic": "2000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSRvaOKfsWHVfS6viBoWEaH6C_Ewl900YqonojwWilgCQAwvPVmpYLvZVBOMB4",
          "picture_source": "Cointelegraph"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399963+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399963Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 586,
          "country": "US",
          "rank": 7,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "ethereum price",
          "approx_traffic": "500+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcSUbIjCMOTPCwY6vg-fSB-7DOc-PH1sSapgAJjmryUMAPMql3rrnZZONNknhwA",
          "picture_source": "Cointelegraph"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399972+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399972Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 588,
          "country": "US",
          "rank": 8,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "ethereum",
          "approx_traffic": "200+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8lcaRUHBs1yG3Z3A4xxEVndyt2LzdlwK8fqG4dHYbxwl_U_1s2fa81EuRCK0",
          "picture_source": "Nasdaq"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399978+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399978Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 589,
          "country": "US",
          "rank": 9,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "solana price",
          "approx_traffic": "100+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQYIilNCZfqNCX3RRaUCihqbTme4p3mWhSanYf1f0TX110wcC7NwAVDCEm-qmg",
          "picture_source": "CCN.com"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "trend:US:unknown:2025-09-22T12:18:48.399984+00:00",
      "persona_account_id": 2,
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T12:18:48.399984Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": {
          "id": 590,
          "country": "US",
          "rank": 10,
          "retrieved": "2025-09-22T17:16:51Z",
          "title": "btc",
          "approx_traffic": "2000+",
          "link": "https://trends.google.com/trending/rss?geo=US",
          "pub_date": null,
          "picture": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcSvaP9K6LKqvvUPxtEUPSpoVQFswJlEUuiXpl5x7fv2bBqtbNH7ilILDXUFSho",
          "picture_source": "The Block"
        },
        "phase": "queried"
      },
      "operators": [
        "bff.timeline.trends"
      ],
      "correlation_keys": {
        "country": "US"
      },
      "origin_flow": "bff.timeline.trends"
    },
    {
      "event_id": "post_publication:7:scheduled",
      "persona_account_id": 2,
      "source": "post_publication",
      "kind": "post_publication.lifecycle",
      "timestamp": "2025-09-24T08:55:00Z",
      "status": "scheduled",
      "payload": {
        "phase_source": "post_publication",
        "post_publication": {
          "id": 7,
          "variant_id": 73,
          "account_persona_id": 2,
          "platform": "threads",
          "external_id": null,
          "permalink": null,
          "status": "scheduled",
          "scheduled_at": "2025-09-24T08:55:00Z",
          "published_at": null,
          "deleted_at": null,
          "monitoring_started_at": null,
          "monitoring_ended_at": null,
          "last_polled_at": null,
          "errors": null,
          "warnings": null,
          "meta": null,
          "created_at": "2025-09-21T23:41:34.771705Z",
          "updated_at": "2025-09-21T23:55:40.895227Z"
        },
        "phase": "scheduled",
        "status": "scheduled"
      },
      "operators": [
        "bff.timeline.post_publications"
      ],
      "correlation_keys": {
        "post_publication_id": "7",
        "variant_id": "73",
        "platform": "threads"
      },
      "origin_flow": "bff.timeline.post_publications"
    }
  ],
  "payload": {
    "persona_account_id": 2,
    "since": null,
    "until": null,
    "limit": 200,
    "events": {
      "source": "composed",
      "events": [
        {
          "event_id": "post_publication:7:created",
          "persona_account_id": 2,
          "source": "post_publication",
          "kind": "post_publication.lifecycle",
          "timestamp": "2025-09-21T23:41:34.771705Z",
          "status": "pending",
          "payload": {
            "phase_source": "post_publication",
            "post_publication": {
              "id": 7,
              "variant_id": 73,
              "account_persona_id": 2,
              "platform": "threads",
              "external_id": null,
              "permalink": null,
              "status": "scheduled",
              "scheduled_at": "2025-09-24T08:55:00Z",
              "published_at": null,
              "deleted_at": null,
              "monitoring_started_at": null,
              "monitoring_ended_at": null,
              "last_polled_at": null,
              "errors": null,
              "warnings": null,
              "meta": null,
              "created_at": "2025-09-21T23:41:34.771705Z",
              "updated_at": "2025-09-21T23:55:40.895227Z"
            },
            "phase": "created",
            "status": "scheduled"
          },
          "operators": [
            "bff.timeline.post_publications"
          ],
          "correlation_keys": {
            "post_publication_id": "7",
            "variant_id": "73",
            "platform": "threads"
          },
          "origin_flow": "bff.timeline.post_publications"
        },
        {
          "event_id": "post_publication:7:scheduled",
          "persona_account_id": 2,
          "source": "post_publication",
          "kind": "post_publication.lifecycle",
          "timestamp": "2025-09-24T08:55:00Z",
          "status": "scheduled",
          "payload": {
            "phase_source": "post_publication",
            "post_publication": {
              "id": 7,
              "variant_id": 73,
              "account_persona_id": 2,
              "platform": "threads",
              "external_id": null,
              "permalink": null,
              "status": "scheduled",
              "scheduled_at": "2025-09-24T08:55:00Z",
              "published_at": null,
              "deleted_at": null,
              "monitoring_started_at": null,
              "monitoring_ended_at": null,
              "last_polled_at": null,
              "errors": null,
              "warnings": null,
              "meta": null,
              "created_at": "2025-09-21T23:41:34.771705Z",
              "updated_at": "2025-09-21T23:55:40.895227Z"
            },
            "phase": "scheduled",
            "status": "scheduled"
          },
          "operators": [
            "bff.timeline.post_publications"
          ],
          "correlation_keys": {
            "post_publication_id": "7",
            "variant_id": "73",
            "platform": "threads"
          },
          "origin_flow": "bff.timeline.post_publications"
        }
      ]
    }
  }
}
```
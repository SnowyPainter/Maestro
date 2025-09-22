# Timeline API Documentation

## Overview

Timeline API는 사용자의 다양한 활동 데이터를 시간순으로 정렬된 이벤트 형태로 제공합니다. Post Publications, Campaign KPIs, Trends 등의 여러 데이터 소스를 통합하여 일관된 타임라인을 구성합니다.

## Architecture

### Data Sources
- **Post Publications**: 게시물 라이프사이클 이벤트 (생성, 예약, 발행, 모니터링 등)
- **Campaign KPIs**: 캠페인 성과 지표 결과
- **Trends**: 트렌드 데이터 조회 결과

### Flow Structure
각 데이터 소스별로 독립적인 BFF Flow가 정의되어 있으며, 어댑터를 통해 체이닝이 가능합니다.

```
TimelineQueryPayload → [Adapter Chain] → TimelineEventCollectionOut
```

### Registry Integration
- Registry에 `timeline_result_adapter`가 `"bff.timeline.*"` 패턴으로 등록
- Flow 체이닝 시 자동으로 이벤트가 누적되어 composed result 생성

## API Endpoints

### Individual Timeline Flows
- `GET /timeline/post-publications` - 게시물 타임라인
- `GET /timeline/campaigns` - 캠페인 KPI 타임라인
- `GET /timeline/trends` - 트렌드 타임라인

### Parameters
```typescript
interface TimelineQueryPayload {
  persona_account_id: number;
  since?: string;  // ISO datetime
  until?: string;  // ISO datetime
  limit?: number;  // 1-2000, default 200
}
```

## Response Schema

### TimelineEventCollectionOut
```typescript
interface TimelineEventCollectionOut {
  source: string;           // "post_publications" | "campaigns" | "trends" | "composed"
  payload: object;          // 쿼리 페이로드 및 추가 메타데이터
  events: TimelineEvent[];  // 시간순 정렬된 이벤트 배열
}
```

### TimelineEvent
```typescript
interface TimelineEvent {
  event_id: string;              // 고유 이벤트 ID
  persona_account_id: number;     // 사용자/페르소나 ID
  source: string;                // 데이터 소스 ("post_publication", "campaign_kpi", "trends")
  kind: string;                  // 이벤트 종류 ("post_publication.lifecycle", "campaign.kpi_result", "trends.query_result")
  timestamp: string;             // ISO 8601 datetime (timezone-aware)
  status: string;                // 이벤트 상태
  payload: object;               // 이벤트별 상세 데이터
  operators: string[];           // 관련 오퍼레이터
  correlation_keys: Record<string, string>; // 연관 키
  origin_flow: string;           // 생성한 플로우
}
```

## Flow Chaining & Composition

### Individual Flow Response
각 Flow를 단독으로 호출하면 해당 소스의 이벤트만 포함:

```json
{
  "source": "post_publications",
  "payload": { "persona_account_id": 2, "since": "2025-09-01T00:00:00Z" },
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
        "post_publication": { ... },
        "phase": "created",
        "status": "scheduled"
      },
      "operators": ["bff.timeline.post_publications"],
      "correlation_keys": {
        "post_publication_id": "7",
        "variant_id": "73",
        "platform": "threads"
      },
      "origin_flow": "bff.timeline.post_publications"
    }
  ]
}
```

### Composed Flow Response
여러 Flow를 체이닝하면 `timeline_result_adapter`가 자동으로 이벤트들을 합쳐서 반환:

```json
{
  "source": "composed",
  "payload": {
    "persona_account_id": 2,
    "since": "2025-09-01T00:00:00Z",
    "events": {
      "source": "composed",
      "events": [...]
    }
  },
  "events": [
    // Post Publication 이벤트들
    {
      "event_id": "post_publication:7:created",
      "source": "post_publication",
      ...
    },
    {
      "event_id": "post_publication:7:scheduled",
      "source": "post_publication",
      ...
    },

    // Campaign KPI 이벤트들
    {
      "event_id": "campaign_kpi:123:2025-09-22T10:00:00Z",
      "source": "campaign_kpi",
      "kind": "campaign.kpi_result",
      "timestamp": "2025-09-22T10:00:00Z",
      "status": "recorded",
      "payload": {
        "phase_source": "campaign_kpi",
        "kpi_result": {
          "campaign_id": 123,
          "as_of": "2025-09-22T10:00:00Z",
          "values": { "impressions": 1500, "clicks": 45, ... }
        }
      },
      "operators": ["bff.timeline.campaigns"],
      "correlation_keys": { "campaign_id": "123" },
      "origin_flow": "bff.timeline.campaigns"
    },

    // Trends 이벤트들
    {
      "event_id": "trend:US:AI:2025-09-22T00:00:00Z",
      "source": "trends",
      "kind": "trends.query_result",
      "timestamp": "2025-09-22T00:00:00Z",
      "status": "queried",
      "payload": {
        "phase_source": "trends",
        "country": "US",
        "source_type": "db",
        "trend_data": { "keyword": "AI", "rank": 1, ... }
      },
      "operators": ["bff.timeline.trends"],
      "correlation_keys": { "country": "US" },
      "origin_flow": "bff.timeline.trends"
    }
  ]
}
```

## Flow Chaining Behavior

### Automatic Composition
- Registry에 등록된 `timeline_result_adapter`가 `"bff.timeline.*"` → `"bff.timeline.*"` 패턴으로 적용
- Flow 체이닝 시 각 단계의 `TimelineEventCollectionOut`이 입력으로 들어오면 어댑터가 자동으로 이벤트를 누적
- 최종 결과는 모든 소스의 이벤트를 시간순으로 정렬하여 반환

### Example Chaining Flow
```
1. Post Publications Flow → TimelineEventCollectionOut (events: [post_events])
2. Adapter → TimelineQueryPayload (events: post_events)
3. Campaign KPIs Flow → TimelineEventCollectionOut (events: [campaign_events])
4. Adapter → TimelineQueryPayload (events: post_events + campaign_events)
5. Trends Flow → TimelineEventCollectionOut (events: [trend_events])
6. Adapter → TimelineQueryPayload (events: post_events + campaign_events + trend_events)
7. Final Result → TimelineEventCollectionOut (source: "composed", events: all_events_sorted)
```

### Usage Patterns
1. **단일 소스 조회**: `GET /timeline/post-publications` - 특정 소스만 조회
2. **다중 소스 통합**: Planner를 통한 Flow 체이닝으로 모든 이벤트 통합 조회
3. **필터링**: `since`/`until` 파라미터로 시간 범위 필터링
4. **페이징**: `limit` 파라미터로 결과 수 제한 (기본 200, 최대 2000)

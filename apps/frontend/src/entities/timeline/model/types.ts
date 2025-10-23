/* eslint-disable */
import { PostPublicationOut, TrendItem } from "@/lib/api/generated";

/**
 * Represents a single event in the timeline.
 * This is a discriminated union based on the `source` property.
 */
type KnownTimelineSources = 'post_publication' | 'trends' | 'playbook' | 'campaign_kpi';

type KnownTimelineEvent =
  | (BaseTimelineEvent & {
      source: 'post_publication';
      payload: PostPublicationPayload;
      correlation_keys: {
        post_publication_id: string;
        variant_id: string;
        platform: string;
        [key: string]: string;
      };
    })
  | (BaseTimelineEvent & {
      source: 'trends';
      payload: TrendPayload;
      correlation_keys: {
        country: string;
        [key: string]: string;
      };
    })
  | (BaseTimelineEvent & {
      source: 'playbook';
      payload: PlaybookPayload;
      correlation_keys: PlaybookCorrelationKeys;
    })
  | (BaseTimelineEvent & {
      source: 'campaign_kpi';
      payload: CampaignKpiPayload;
      correlation_keys: {
        campaign_id: string;
        [key: string]: string;
      };
    });

type GenericTimelineEvent = BaseTimelineEvent & {
  source: Exclude<string, KnownTimelineSources>;
  payload: GenericPayload;
  correlation_keys: Record<string, string>;
};

export type TimelineEvent = KnownTimelineEvent | GenericTimelineEvent;

/**
 * Base interface for all timeline events.
 */
export interface BaseTimelineEvent {
  event_id: string;
  persona_account_id: number;
  source: string;
  kind: string;
  timestamp: string; // ISO 8601 date string
  status: string;
  operators: string[];
  origin_flow: string;
}

/**
 * Payload for post_publication events.
 */
export interface PostPublicationPayload {
  phase_source: 'post_publication';
  post_publication: PostPublicationOut;
  phase:
    | 'created'
    | 'scheduled'
    | 'published'
    | 'monitoring_started'
    | 'monitoring_ended'
    | 'deleted'
    | 'cancelled'
    | 'failed';
  status: string;
}

/**
 * Payload for trends events.
 */
export interface TrendPayload {
  phase_source: 'trends';
  country: string;
  source_type: 'db' | 'live';
  trend_data: TrendItem;
  phase: 'queried';
}

/**
 * Payload for campaign KPI events.
 */
export interface CampaignKpiPayload {
  phase_source: 'campaign_kpi';
  kpi_result: {
    campaign_id: number;
    as_of: string;
    values: Record<string, number>;
  };
  phase: 'recorded';
}

/**
 * A log entry from a playbook execution.
 */
export interface PlaybookLog {
  id: number;
  playbook_id: number;
  event: string;
  timestamp: string;
  draft_id: number | null;
  schedule_id: number | null;
  abtest_id: number | null;
  ref_id: number | null;
  persona_snapshot: Record<string, any> | null;
  trend_snapshot: Record<string, any> | null;
  llm_input: Record<string, any> | null;
  llm_output: Record<string, any> | null;
  kpi_snapshot: Record<string, any> | null;
  meta: { [key: string]: any } | null;
  message: string | null;
  created_at: string;
  summary?: PlaybookLogSummary;
}

/**
 * Payload for playbook events.
 */
export interface PlaybookPayload {
  phase_source: 'playbook_log';
  playbook_log: PlaybookLog;
  summary?: PlaybookLogSummary;
  meta?: Record<string, any> | null;
  identifiers?: Record<string, any> | null;
}

/**
 * A generic payload for other event types.
 */
export interface GenericPayload {
  phase_source: string;
  [key: string]: any;
}

export interface PlaybookLogSummary {
  title: string;
  message?: string | null;
  highlights?: Array<{ label: string; value: string }>;
}

export interface PlaybookCorrelationKeys {
  playbook_id: string;
  event: string;
  schedule_id?: string;
  draft_id?: string;
  abtest_id?: string;
  [key: string]: string | undefined;
}

/**
 * Represents a group of events that occur at the same time.
 */
export interface TimelineEventGroup {
  timestamp: string;
  events: TimelineEvent[];
}

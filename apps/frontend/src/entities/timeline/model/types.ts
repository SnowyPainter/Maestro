/* eslint-disable */
import { PostPublicationOut, TrendItem } from "@/lib/api/generated";

/**
 * Represents a single event in the timeline.
 * This is a discriminated union based on the `source` property.
 */
export type TimelineEvent = BaseTimelineEvent & (
  | {
      source: 'post_publication';
      payload: PostPublicationPayload;
      correlation_keys: {
        post_publication_id: string;
        variant_id: string;
        platform: string;
      };
    }
  | {
      source: 'trends';
      payload: TrendPayload;
      correlation_keys: {
        country: string;
      };
    }
  | {
      source: 'playbook';
      payload: PlaybookPayload;
      correlation_keys: {
        playbook_id: string;
        [key: string]: string;
      };
    }
  | {
      source: 'kpis' | 'unknown'; // etc.
      payload: GenericPayload;
      correlation_keys: Record<string, string>;
    }
);

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
  phase: 'created' | 'scheduled' | 'published' | 'failed';
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
  ref_id: string | null;
  persona_snapshot: any | null;
  trend_snapshot: any | null;
  llm_input: string | null;
  llm_output: string | null;
  kpi_snapshot: any | null;
  meta: { [key: string]: any } | null;
  message: string | null;
  created_at: string;
}

/**
 * Payload for playbook events.
 */
export interface PlaybookPayload {
  phase_source: 'playbook_log';
  playbook_log: PlaybookLog;
}

/**
 * A generic payload for other event types.
 */
export interface GenericPayload {
  phase_source: string;
  [key: string]: any;
}

/**
 * Represents a group of events that occur at the same time.
 */
export interface TimelineEventGroup {
  timestamp: string;
  events: TimelineEvent[];
}

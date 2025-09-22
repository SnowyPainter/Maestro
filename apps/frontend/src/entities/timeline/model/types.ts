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

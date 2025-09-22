import { TimelineEvent, TimelineEventGroup } from "./types";
import { parseISO, compareDesc, roundToNearestMinutes, startOfHour, startOfDay } from 'date-fns';

export type TimelineScale = '1h' | '3h' | '1d';

/**
 * Groups events by a given time scale and then by source.
 * @param events The raw timeline events.
 * @param scale The time scale to group by.
 * @returns A map of time buckets to a map of sources to events.
 */
export const groupAndBucketEvents = (
  events: TimelineEvent[],
  scale: TimelineScale
): Map<string, Map<string, TimelineEvent[]>> => {
  const buckets = new Map<string, Map<string, TimelineEvent[]>>();

  events.forEach(event => {
    const timestamp = parseISO(event.timestamp);
    let bucketKey: string;

    switch (scale) {
      case '1h':
        bucketKey = startOfHour(timestamp).toISOString();
        break;
      case '3h':
        const hour = timestamp.getHours();
        const roundedHour = Math.floor(hour / 3) * 3;
        const rounded = new Date(timestamp);
        rounded.setHours(roundedHour, 0, 0, 0);
        bucketKey = rounded.toISOString();
        break;
      case '1d':
        bucketKey = startOfDay(timestamp).toISOString();
        break;
    }

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, new Map<string, TimelineEvent[]>());
    }

    const sourceMap = buckets.get(bucketKey)!;
    if (!sourceMap.has(event.source)) {
      sourceMap.set(event.source, []);
    }

    sourceMap.get(event.source)!.push(event);
  });

  // Sort buckets chronologically
  const sortedBuckets = new Map([...buckets.entries()].sort((a, b) => {
    return compareDesc(new Date(a[0]), new Date(b[0]));
  }));


  return sortedBuckets;
};

/**
 * Sorts timeline events in descending order of their timestamp.
 */
export const sortEvents = (events: TimelineEvent[]): TimelineEvent[] => {
  return [...events].sort((a, b) => {
    try {
      const dateA = parseISO(a.timestamp);
      const dateB = parseISO(b.timestamp);
      return compareDesc(dateA, dateB);
    } catch {
      // Fallback for invalid date strings
      return 0;
    }
  });
};

/**
 * Filters events based on a set of selected sources.
 * @param events The list of all timeline events.
 * @param activeSources A Set of source strings to display (e.g., {'trends', 'post_publication'}).
 * @returns A filtered list of timeline events.
 */
export const filterEventsBySource = (events: TimelineEvent[], activeSources: Set<string>): TimelineEvent[] => {
  if (activeSources.size === 0) {
    return events; // No filter, return all
  }
  return events.filter(event => activeSources.has(event.source));
};

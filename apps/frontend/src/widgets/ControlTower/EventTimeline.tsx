import { TimelineEventCard } from './TimelineEventCard';
import { TimelineEvent } from './mock-data';

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
    return (
        <div className="relative pl-8">
            {/* The vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border -z-10" />

            <div className="space-y-10">
                {events.map(event => (
                    <TimelineEventCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    );
}

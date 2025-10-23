import React from 'react';
import { TimelineEvent as TimelineEventType } from '../model/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimelineEvent } from './TimelineEvent';
import { cn } from '@/lib/utils';

interface TimelineCellProps {
  events: TimelineEventType[];
  bucketKey: string;
  source: string;
}

// Returns [backgroundClass, textClass, secondaryTextClass]
const getIntensityClasses = (count: number): [string, string, string] => {
    if (count === 0) {
      return ["bg-muted/20", "text-foreground", "text-muted-foreground"];
    }
    const intensity = Math.min(Math.floor(count / 2), 4);
    const intensityClasses: [string, string, string][] = [
        // 1-2 events
        ["bg-emerald-50 dark:bg-emerald-900/60", "text-emerald-900 dark:text-emerald-200", "text-emerald-700 dark:text-emerald-400"],
        // 3-4
        ["bg-emerald-100 dark:bg-emerald-800/70", "text-emerald-950 dark:text-emerald-100", "text-emerald-800 dark:text-emerald-300"],
        // 5-6
        ["bg-emerald-300 dark:bg-emerald-700/80", "text-emerald-950 dark:text-emerald-50", "text-emerald-900 dark:text-emerald-200"],
        // 7-8
        ["bg-emerald-500 dark:bg-emerald-600/90", "text-white", "text-emerald-100"],
        // > 8
        ["bg-emerald-600 dark:bg-emerald-500", "text-white", "text-emerald-100"],
    ];
    return intensityClasses[intensity];
}

const getEventTitle = (event: TimelineEventType) => {
    if (event.source === 'post_publication') {
        const phase = event.payload.phase || 'event';
        return `Post ${phase}`;
    }
    if (event.source === 'campaign_kpi') {
        const campaignId = event.payload.kpi_result?.campaign_id;
        return campaignId ? `Campaign KPI #${campaignId}` : 'Campaign KPI';
    }
    if (event.source === 'trends') {
        return event.payload.trend_data?.title || 'Trend event';
    }
    if (event.source === 'abtest') {
        const { abtest, phase } = event.payload;
        const base = abtest?.variable ? `AB Test: ${abtest.variable}` : 'AB Test';
        return `${base} (${phase})`;
    }
    if (event.source === 'playbook') {
        const summaryTitle =
          event.payload.summary?.title ||
          event.payload.playbook_log.summary?.title;
        if (summaryTitle) {
          return summaryTitle;
        }
        return `Playbook: ${event.payload.playbook_log.event}`;
    }
    return event.kind;
};


export const TimelineCell: React.FC<TimelineCellProps> = ({ events, bucketKey, source }) => {
  const eventCount = events.length;
  const [bgClass, textClass, secondaryTextClass] = getIntensityClasses(eventCount);
  
  const popoverContent = (
    <PopoverContent className="w-96 max-h-[280px] overflow-y-auto" sideOffset={10} collisionPadding={10}>
        <div className="space-y-2 mb-4">
            {/* Apply smaller font size, inline-block for width control, and max-width */}
            <h4 className="font-medium leading-none capitalize text-sm inline-block max-w-[100px]">{source}</h4>
            <p className="text-sm text-muted-foreground">
                Events around {new Date(bucketKey).toLocaleString()}
            </p>
        </div>
        <div className="space-y-1">
          {events.map(event => (
            <TimelineEvent key={event.event_id} event={event} />
          ))}
        </div>
      </PopoverContent>
  );

  if (eventCount === 0) {
    return <div className="h-24 w-full border-b border-r border-dashed border-border rounded-md" />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'h-24 w-full border-b border-r border-border cursor-pointer p-2 flex flex-col justify-between text-xs transition-all duration-200 ease-in-out hover:shadow-xl hover:scale-105 hover:z-10 relative rounded-md',
            bgClass
          )}
        >
            <div className={cn("space-y-1", secondaryTextClass)}>
                {events.slice(0, 3).map(event => (
                    <p key={event.event_id} className="text-2xs truncate font-medium">
                        {(() => {
                            const title = getEventTitle(event);
                            const wordCount = title.split(' ').length;
                            return wordCount >= 4 ? `${title.substring(0, 25)}...` : title;
                        })()}
                    </p>
                ))}
            </div>
            <div className={cn("text-right font-black text-2xl", textClass)}>
                {eventCount > 3 ? `+${eventCount - 3}` : eventCount}
            </div>
        </div>
      </PopoverTrigger>
      {popoverContent}
    </Popover>
  );
};

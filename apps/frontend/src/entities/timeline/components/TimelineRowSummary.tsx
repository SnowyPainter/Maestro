import React from 'react';
import { TimelineEvent as TimelineEventType } from '../model/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimelineEvent } from './TimelineEvent';
import { TimelineIcon } from './TimelineIcon';
import { cn } from '@/lib/utils';

interface TimelineRowSummaryProps {
  sourceMap: Map<string, TimelineEventType[]>;
  bucketKey: string;
}

export const TimelineRowSummary: React.FC<TimelineRowSummaryProps> = ({ sourceMap, bucketKey }) => {
  const allEvents = Array.from(sourceMap.values()).flat().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const eventCount = allEvents.length;
  const sources = Array.from(sourceMap.keys());

  if (eventCount === 0) {
    return <div className="h-24 w-full border-b border-dashed border-border" />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'h-24 w-full border-b border-border cursor-pointer p-1.5 flex flex-col items-center justify-center text-xs transition-all duration-200 ease-in-out hover:bg-muted/50',
          )}
        >
            <div className="flex mb-2">
                {sources.map(source => <TimelineIcon key={source} source={source} className="h-4 w-4 mx-0.5" />)}
            </div>
            <div className="font-bold text-lg">{eventCount}</div>
            <div className="text-2xs text-muted-foreground">events</div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[280px] overflow-y-auto">
        <div className="space-y-2 mb-4">
            <h4 className="font-medium leading-none">Summary</h4>
            <p className="text-sm text-muted-foreground">
                {eventCount} events around {new Date(bucketKey).toLocaleString()}
            </p>
        </div>
        <div className="space-y-1">
          {allEvents.map(event => (
            <TimelineEvent key={event.event_id} event={event} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

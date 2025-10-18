import React from 'react';
import { TimelineEvent as TimelineEventType } from '../model/types';
import { TimelineIcon } from './TimelineIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimelinePostEvent } from './TimelinePostEvent';
import { TimelineTrendEvent } from './TimelineTrendEvent';
import { format } from 'date-fns';
import { TimelinePlaybookLogEvent } from './TimelinePlaybookLogEvent';

interface TimelineEventProps {
  event: TimelineEventType;
}

const renderEventDetails = (event: TimelineEventType) => {
  switch (event.source) {
    case 'post_publication':
      return <TimelinePostEvent event={event} />;
    case 'trends':
      return <TimelineTrendEvent event={event} />;
    case 'playbook':
      return <TimelinePlaybookLogEvent event={event} />;  
    default:
      return <p>No details available for this event type.</p>;
  }
};

export const TimelineEvent: React.FC<TimelineEventProps> = ({ event }) => {
  const title =
    event.source === 'post_publication'
      ? `Post ${event.payload.phase}`
      : event.source === 'trends'
      ? event.payload.trend_data.title
      : event.source === 'playbook'
      ? `Playbook: ${event.payload.playbook_log.event}`
      : event.kind;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 p-2 rounded-lg">
          <div className="flex-shrink-0">
            <TimelineIcon source={event.source} className="w-5 h-5" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.timestamp), 'p')}
            </p>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {renderEventDetails(event)}
      </PopoverContent>
    </Popover>
  );
};

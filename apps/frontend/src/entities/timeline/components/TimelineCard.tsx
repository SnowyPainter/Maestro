import React, { useState, useMemo } from 'react';
import { TimelineEvent } from '../model/types';
import { groupAndBucketEvents, TimelineScale } from '../model/timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TimelineCell } from './TimelineCell';
import { TimelineRowSummary } from './TimelineRowSummary';
import { Separator } from '@/components/ui/separator';
import { format, isFuture } from 'date-fns';

interface TimelineCardProps {
  events: TimelineEvent[];
  title?: string;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ events, title = "Timeline" }) => {
  const [scale, setScale] = useState<TimelineScale>('1d');

  const allSources = useMemo(() => {
    const sources = new Set(events.map(e => e.source));
    return Array.from(sources).sort();
  }, [events]);

  const bucketedEvents = useMemo(() => {
    return groupAndBucketEvents(events, scale);
  }, [events, scale]);

  const timeBuckets = useMemo(() => {
      return Array.from(bucketedEvents.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [bucketedEvents]);

  const futureStartIndex = timeBuckets.findIndex(bucket => isFuture(new Date(bucket)));

  return (
    <Card className="h-full w-full shadow-lg overflow-hidden">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <ToggleGroup
              type="single"
              variant="outline"
              value={scale}
              onValueChange={(newScale: TimelineScale) => newScale && setScale(newScale)}
          >
              <ToggleGroupItem value="1h">1H</ToggleGroupItem>
              <ToggleGroupItem value="3h">3H</ToggleGroupItem>
              <ToggleGroupItem value="1d">1D</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {events.length > 0 ? (
          <div className="grid" style={{ gridTemplateColumns: `auto repeat(${allSources.length}, 1fr) auto` }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-r font-semibold text-sm flex items-center justify-center p-2">Time</div>
            {allSources.map(source => (
              <div key={source} className="sticky top-0 z-10 bg-background border-b border-r font-semibold text-sm flex items-center justify-center p-2 capitalize">
                {source.replace(/_/g, ' ')}
              </div>
            ))}
            <div className="sticky top-0 z-10 bg-background border-b font-semibold text-sm flex items-center justify-center p-2">Summary</div>
            
            {/* Past Events */}
            {timeBuckets.slice(0, futureStartIndex !== -1 ? futureStartIndex : timeBuckets.length).map(bucketKey => {
                const sourceMap = bucketedEvents.get(bucketKey)!;
                return (
                    <React.Fragment key={bucketKey}>
                        <div className="border-r p-2 text-xs text-muted-foreground flex flex-col items-center justify-center text-center">
                            <span>{format(new Date(bucketKey), 'p')}</span>
                            <span className="text-2xs">{format(new Date(bucketKey), 'MMM d')}</span>
                        </div>
                        {allSources.map(source => (
                            <TimelineCell
                                key={source}
                                bucketKey={bucketKey}
                                source={source}
                                events={sourceMap.get(source) || []}
                            />
                        ))}
                        <TimelineRowSummary bucketKey={bucketKey} sourceMap={sourceMap} />
                    </React.Fragment>
                )
            })}

            {/* Future Separator */}
            {futureStartIndex !== -1 && (
              <div className="col-span-full grid items-center text-center relative my-2" style={{ gridColumn: `1 / -1`}}>
                  <Separator />
                  <span className="text-xs text-muted-foreground bg-background px-2 absolute left-1/2 -translate-x-1/2">Future</span>
              </div>
            )}

            {/* Future Events */}
            {futureStartIndex !== -1 && timeBuckets.slice(futureStartIndex).map(bucketKey => {
                const sourceMap = bucketedEvents.get(bucketKey)!;
                return (
                    <React.Fragment key={bucketKey}>
                        <div className="border-r p-2 text-xs text-muted-foreground flex flex-col items-center justify-center text-center">
                            <span>{format(new Date(bucketKey), 'p')}</span>
                            <span className="text-2xs">{format(new Date(bucketKey), 'MMM d')}</span>
                        </div>
                        {allSources.map(source => (
                            <TimelineCell
                                key={source}
                                bucketKey={bucketKey}
                                source={source}
                                events={sourceMap.get(source) || []}
                            />
                        ))}
                        <TimelineRowSummary bucketKey={bucketKey} sourceMap={sourceMap} />
                    </React.Fragment>
                )
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p>No timeline events to display.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
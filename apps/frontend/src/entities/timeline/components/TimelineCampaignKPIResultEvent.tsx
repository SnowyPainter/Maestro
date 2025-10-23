import React from 'react';
import { TimelineEvent as TimelineEventType } from '../model/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineCampaignKPIResultEventProps {
  event: TimelineEventType;
}

export const TimelineCampaignKPIResultEvent: React.FC<TimelineCampaignKPIResultEventProps> = ({ event }) => {
  if (event.source !== 'campaign_kpi') {
    return null;
  }

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">Campaign KPI Snapshot</CardTitle>
        <Badge variant="outline">#{event.payload.kpi_result.campaign_id}</Badge>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(event.payload.kpi_result.values || {}).map(([key, value]) => (
            <div key={key} className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{key}</p>
              <p className="text-sm font-semibold">
                {typeof value === 'number' ? value.toLocaleString() : String(value)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground">
          As of {new Date(event.payload.kpi_result.as_of).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
};

import React from 'react';
import { TimelineEvent } from '../model/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineTrendEventProps {
  event: TimelineEvent;
}

export const TimelineTrendEvent: React.FC<TimelineTrendEventProps> = ({ event }) => {
  if (event.source !== 'trends') return null;

  const { trend_data, country } = event.payload;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current Trend</span>
          <Badge variant="outline">{country}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <p className="font-semibold">{trend_data.title}</p>
        <p className="text-muted-foreground">Traffic: {trend_data.approx_traffic}</p>
        {trend_data.link && (
          <a href={trend_data.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mt-2 inline-block">
            View on Site
          </a>
        )}
        {trend_data.picture && (
            <img src={trend_data.picture} alt={trend_data.title} className="mt-4 rounded-lg" />
        )}
      </CardContent>
    </Card>
  );
};

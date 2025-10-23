import React from 'react';
import { TimelineEvent as TimelineEventType } from '../model/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineAbTestEventProps {
  event: TimelineEventType;
}

export const TimelineAbTestEvent: React.FC<TimelineAbTestEventProps> = ({ event }) => {
  if (event.source !== 'abtest') {
    return null;
  }

  const { abtest, phase } = event.payload;
  const winner = abtest.winner_variant ? `Winner: ${abtest.winner_variant}` : null;
  const uplift = typeof abtest.uplift_percentage === 'number' ? `${abtest.uplift_percentage.toFixed(2)}% uplift` : null;

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">AB Test</CardTitle>
        <Badge variant="outline" className="capitalize">{phase}</Badge>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="space-y-1">
          {abtest.variable && (
            <p>
              <span className="font-semibold">Variable:</span> {abtest.variable}
            </p>
          )}
          {abtest.hypothesis && (
            <p>
              <span className="font-semibold">Hypothesis:</span> {abtest.hypothesis}
            </p>
          )}
          <p>
            <span className="font-semibold">Variants:</span> A #{abtest.variant_a_id} vs B #{abtest.variant_b_id}
          </p>
        </div>
        <div className="space-y-1 text-muted-foreground">
          <p>
            <span className="font-semibold">Started:</span> {new Date(abtest.started_at).toLocaleString()}
          </p>
          {abtest.finished_at && (
            <p>
              <span className="font-semibold">Finished:</span> {new Date(abtest.finished_at).toLocaleString()}
            </p>
          )}
        </div>
        {(winner || uplift) && (
          <div className="space-y-1">
            {winner && <p className="font-semibold text-emerald-600 dark:text-emerald-300">{winner}</p>}
            {uplift && <p className="text-muted-foreground">{uplift}</p>}
          </div>
        )}
        {abtest.notes && (
          <p className="text-muted-foreground">{abtest.notes}</p>
        )}
      </CardContent>
    </Card>
  );
};

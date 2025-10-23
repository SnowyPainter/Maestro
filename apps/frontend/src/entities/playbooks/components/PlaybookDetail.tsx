import { useState } from "react";
import { useBffPlaybookSearchPlaybooksApiBffPlaybooksSearchGet } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function PlaybookDetail({ playbookId, onDelete }: { playbookId: number, onDelete: () => void }) {
  const { data: playbook, isLoading, isError } = useBffPlaybookSearchPlaybooksApiBffPlaybooksSearchGet({
    playbook_id: playbookId
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !playbook?.items || playbook.items.length === 0) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load playbook details.</p>
        </CardContent>
      </Card>
    );
  }

  const pb = playbook.items[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playbook {pb.id}</CardTitle>
        <CardDescription>
          {pb.campaign_name} × {pb.persona_name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-primary mb-1">Campaign</h4>
              <p className="font-medium">{pb.campaign_name}</p>
              {pb.campaign_description && (
                <p className="text-muted-foreground text-xs">{pb.campaign_description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">ID: {pb.campaign_id}</p>
            </div>
            <div>
              <h4 className="font-medium text-secondary mb-1">Persona</h4>
              <p className="font-medium">{pb.persona_name}</p>
              {pb.persona_bio && (
                <p className="text-muted-foreground text-xs">{pb.persona_bio}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">ID: {pb.persona_id}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Event:</span>
              <Badge variant="outline">{pb.last_event || "None"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="text-xs">{new Date(pb.last_updated).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span className="text-xs">{new Date(pb.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {pb.aggregate_kpi && Object.keys(pb.aggregate_kpi).length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-foreground mb-2">Aggregate KPIs</h4>
            <div className="space-y-1">
              {Object.entries(pb.aggregate_kpi).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{key}:</span>
                  <span>{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pb.best_time_window && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-foreground mb-2">Optimization Insights</h4>
            <div className="space-y-2">
              {pb.best_time_window && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best Time Window:</span>
                  <Badge variant="secondary">{pb.best_time_window}</Badge>
                </div>
              )}
              {pb.best_tone && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best Tone:</span>
                  <Badge variant="secondary">{pb.best_tone}</Badge>
                </div>
              )}
              {pb.top_hashtags && pb.top_hashtags.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Top Hashtags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pb.top_hashtags.map((hashtag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {hashtag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

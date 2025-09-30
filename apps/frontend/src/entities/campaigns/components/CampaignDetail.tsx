import { useState } from "react";
import {
  useBffCampaignsReadCampaignApiBffCampaignsCampaignIdGet,
  useCampaignsDeleteCampaignApiOrchestratorCampaignsCampaignIdDelete,
  getBffCampaignsListCampaignsApiBffCampaignsGetQueryKey,
  useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet,
  campaignsAggregateKpisApiOrchestratorCampaignsCampaignIdAggregateKpisPost,
  CampaignKPIDefOut,
  CampaignKPIResultOut,
} from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditCampaignForm } from "@/features/campaigns/components/EditCampaignForm";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { EditKpiForm } from "@/features/campaigns/components/EditKpiForm";

function KpiDetails({ campaignId }: { campaignId: number }) {
  const { data: kpiDefs, isLoading: isLoadingDefs, isError: isErrorDefs } = useBffCampaignsListKpiDefsApiBffCampaignsCampaignIdKpiDefsGet(campaignId);

  const { data: aggregatedResult, isLoading: isLoadingAggregation, isError: isErrorAggregation } = useQuery<CampaignKPIResultOut>({
    queryKey: ['campaignAggregation', campaignId],
    queryFn: () => campaignsAggregateKpisApiOrchestratorCampaignsCampaignIdAggregateKpisPost(campaignId, {}),
    enabled: !!kpiDefs && kpiDefs.length > 0,
  });

  if (isLoadingDefs) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (isErrorDefs) {
    return <p className="text-xs text-destructive">Failed to load KPI definitions.</p>;
  }

  if (!kpiDefs || kpiDefs.length === 0) {
    return <p className="text-xs text-muted-foreground">No KPIs defined for this campaign.</p>;
  }

  if (isLoadingAggregation) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (isErrorAggregation) {
    return <p className="text-xs text-destructive">Failed to load KPI results.</p>;
  }

  return (
    <div className="space-y-3">
      {kpiDefs.map((def: CampaignKPIDefOut) => {
        const currentValue = aggregatedResult?.values[def.key] ?? 0;
        const targetValue = def.target_value ?? 0;
        const progress = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

        return (
          <div key={def.id}>
            <div className="flex justify-between mb-1 text-sm">
              <span className="text-muted-foreground">{def.key} <span className="text-xs">({def.aggregation})</span></span>
              <span>{`${Math.floor(currentValue)} / ${targetValue}`} ({Math.round(progress)}%)</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        );
      })}
    </div>
  );
}

export function CampaignDetail({ campaignId, onDelete }: { campaignId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingKpis, setIsEditingKpis] = useState(false);
  const queryClient = useQueryClient();
  const { data: campaign, isLoading, isError } = useBffCampaignsReadCampaignApiBffCampaignsCampaignIdGet(campaignId);

  const { mutate: deleteCampaign, isPending: isDeleting } = useCampaignsDeleteCampaignApiOrchestratorCampaignsCampaignIdDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffCampaignsListCampaignsApiBffCampaignsGetQueryKey() });
        onDelete();
      },
    }
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !campaign) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load campaign details.</p>
        </CardContent>
      </Card>
    );
  }

  const handleDelete = () => {
    deleteCampaign({ campaignId });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{campaign.name}</CardTitle>
        <CardDescription>{campaign.description || "No description."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
            <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date:</span>
                <span>{campaign.start_at ? new Date(campaign.start_at).toLocaleDateString() : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-muted-foreground">End Date:</span>
                <span>{campaign.end_at ? new Date(campaign.end_at).toLocaleDateString() : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
            </div>
        </div>
        <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-foreground">Key Performance Indicators</h4>
                <Dialog open={isEditingKpis} onOpenChange={setIsEditingKpis}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Manage KPIs</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Manage KPIs for {campaign.name}</DialogTitle>
                        </DialogHeader>
                        <EditKpiForm campaignId={campaign.id} onSuccess={() => setIsEditingKpis(false)} />
                    </DialogContent>
                </Dialog>
            </div>
            <KpiDetails campaignId={campaign.id} />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Campaign</DialogTitle>
                </DialogHeader>
                <EditCampaignForm campaign={campaign} onSuccess={() => setIsEditing(false)} />
            </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this
                campaign and all its associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

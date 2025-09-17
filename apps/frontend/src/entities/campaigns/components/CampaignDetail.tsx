import { useState } from "react";
import {
  useBffCampaignsReadCampaignApiBffCampaignsCampaignIdGet,
  useCampaignsDeleteCampaignApiOrchestratorCampaignsCampaignIdDelete,
  getBffCampaignsListCampaignsApiBffCampaignsGetQueryKey,
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
import { useQueryClient } from "@tanstack/react-query";

export function CampaignDetail({ campaignId, onDelete }: { campaignId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
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
    return <Skeleton className="h-48 w-full" />;
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
      <CardContent className="space-y-2 text-sm">
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

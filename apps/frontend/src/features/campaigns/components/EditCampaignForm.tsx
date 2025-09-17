import { useState } from "react";
import { 
    useCampaignsUpdateCampaignApiOrchestratorCampaignsCampaignIdPut,
    getBffCampaignsReadCampaignApiBffCampaignsCampaignIdGetQueryKey,
    CampaignOut,
} from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

export function EditCampaignForm({ campaign, onSuccess }: { campaign: CampaignOut, onSuccess: () => void }) {
  const [name, setName] = useState(campaign.name || "");
  const [description, setDescription] = useState(campaign.description || "");
  const [startAt, setStartAt] = useState(campaign.start_at ? new Date(campaign.start_at).toISOString().split('T')[0] : "");
  const [endAt, setEndAt] = useState(campaign.end_at ? new Date(campaign.end_at).toISOString().split('T')[0] : "");

  const queryClient = useQueryClient();

  const { mutate: updateCampaign, isPending } = useCampaignsUpdateCampaignApiOrchestratorCampaignsCampaignIdPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffCampaignsReadCampaignApiBffCampaignsCampaignIdGetQueryKey(campaign.id) });
        onSuccess();
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaign({ 
        campaignId: campaign.id,
        data: { 
            name, 
            description: description || null,
            start_at: startAt ? new Date(startAt).toISOString() : null,
            end_at: endAt ? new Date(endAt).toISOString() : null,
        }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg">
      <div className="grid gap-2">
        <label htmlFor="name">Campaign Name</label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Sale 2025"
          required
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="description">Description (Optional)</label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of the campaign's goals."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
            <label htmlFor="start_at">Start Date</label>
            <Input
            id="start_at"
            type="date"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            />
        </div>
        <div className="grid gap-2">
            <label htmlFor="end_at">End Date</label>
            <Input
            id="end_at"
            type="date"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Update Campaign"}
      </Button>
    </form>
  );
}

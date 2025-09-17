import { useState } from "react";
import { useCampaignsCreateCampaignApiOrchestratorCampaignsPost, getBffCampaignsListCampaignsApiBffCampaignsGetQueryKey } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

export function CreateCampaignForm({ onSuccess }: { onSuccess: (campaignId: number) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const queryClient = useQueryClient();

  const { mutate: createCampaign, isPending } = useCampaignsCreateCampaignApiOrchestratorCampaignsPost({
    mutation: {
      onSuccess: (data) => {
        onSuccess(data.id);
        queryClient.invalidateQueries({ queryKey: getBffCampaignsListCampaignsApiBffCampaignsGetQueryKey() });
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign({ data: { 
        name, 
        description: description || null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
    } });
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
        {isPending ? "Creating..." : "Create Campaign"}
      </Button>
    </form>
  );
}
import { useState } from "react";
import { 
    useDraftsCreateApiOrchestratorDraftsPost, 
    getBffDraftsListDraftsApiBffDraftsGetQueryKey,
    useBffCampaignsListCampaignsApiBffCampaignsGet,
} from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { components } from "@/lib/types/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DraftIREditor } from "@/components/Draft/DraftIREditor";

type DraftIR = components["schemas"]["DraftIR"];

export function CreateDraftForm({ onSuccess }: { onSuccess: (draftId: number) => void }) {
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<DraftIR['blocks']>([]);
  const [goal, setGoal] = useState("");
  const [tags, setTags] = useState("");
  const [campaignId, setCampaignId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: campaigns } = useBffCampaignsListCampaignsApiBffCampaignsGet();

  const { mutate: createDraft, isPending } = useDraftsCreateApiOrchestratorDraftsPost({
    mutation: {
      onSuccess: (data) => {
        onSuccess(data.id);
        queryClient.invalidateQueries({ queryKey: getBffDraftsListDraftsApiBffDraftsGetQueryKey() });
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ir: DraftIR = {
      blocks: blocks,
      options: {}
    };
    createDraft({ data: { 
        title: title || null, 
        ir, 
        goal: goal || null, 
        tags: tags.split(',').map(t => t.trim()).filter(t => t), 
        campaign_id: campaignId 
    } });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg">
      <div className="grid gap-2">
        <label htmlFor="title">Draft Title</label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My new blog post"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="text">Content</label>
        <DraftIREditor
          initialBlocks={[]}
          onBlocksChange={setBlocks}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="goal">Goal (Optional)</label>
        <Textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What is the goal of this draft?"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="campaign">Campaign (Optional)</label>
        <Select onValueChange={(value) => setCampaignId(Number(value))}>
            <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
                {campaigns?.map(campaign => (
                    <SelectItem key={campaign.id} value={String(campaign.id)}>
                        {campaign.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <label htmlFor="tags">Tags (Optional, comma-separated)</label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. marketing, social-media"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Draft"}
      </Button>
    </form>
  );
}
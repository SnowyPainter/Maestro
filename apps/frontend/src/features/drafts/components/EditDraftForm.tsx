import { useState } from "react";
import { 
    useDraftsUpdateIrApiOrchestratorDraftsDraftIdIrPut,
    getBffDraftsReadDraftApiBffDraftsDraftIdGetQueryKey,
    useBffCampaignsListCampaignsApiBffCampaignsGet,
} from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DraftIR, DraftOut } from "@/lib/api/generated";

export function EditDraftForm({ draft, onSuccess }: { draft: DraftOut, onSuccess: () => void }) {
  const [title, setTitle] = useState(draft.title || "");
  const [text, setText] = useState((draft.ir as DraftIR).blocks[0]?.props.markdown || "");
  const [goal, setGoal] = useState(draft.goal || "");
  const [tags, setTags] = useState(draft.tags?.join(', ') || "");
  const [campaignId, setCampaignId] = useState<number | null>(draft.campaign_id || null);

  const queryClient = useQueryClient();

  const { data: campaigns } = useBffCampaignsListCampaignsApiBffCampaignsGet();

  const { mutate: updateDraft, isPending } = useDraftsUpdateIrApiOrchestratorDraftsDraftIdIrPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffDraftsReadDraftApiBffDraftsDraftIdGetQueryKey(draft.id) });
        onSuccess();
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ir: DraftIR = {
      blocks: [{ type: "text", props: { markdown: text } }],
      options: {}
    };
    updateDraft({ 
        draftId: draft.id,
        data: { 
            title: title || null, 
            ir, 
            goal: goal || null, 
            tags: tags.split(',').map(t => t.trim()).filter(t => t), 
            campaign_id: campaignId 
        } 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg max-h-[70vh] overflow-y-auto">
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
        <Textarea
          id="text"
          value={text as string}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing your draft..."
          required
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
        <Select defaultValue={campaignId ? String(campaignId) : undefined} onValueChange={(value) => setCampaignId(Number(value))}>
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
        {isPending ? "Updating..." : "Update Draft"}
      </Button>
    </form>
  );
}

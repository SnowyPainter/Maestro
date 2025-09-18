import { useState, useEffect, useCallback, useRef } from "react";
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
import { DraftIREditor } from "@/components/Draft/DraftIREditor";
import { AlertCircle } from "lucide-react";

export function EditDraftForm({ draft, onSuccess }: { draft: DraftOut, onSuccess: () => void }) {
  const [title, setTitle] = useState(draft.title || "");
  const [blocks, setBlocks] = useState<DraftIR['blocks']>((draft.ir as DraftIR).blocks || []);
  const [goal, setGoal] = useState(draft.goal || "");
  const [tags, setTags] = useState(draft.tags?.join(', ') || "");
  const [campaignId, setCampaignId] = useState<number | null>(draft.campaign_id || null);

  // 초기값 저장
  const initialValues = useRef({
    title: draft.title || "",
    blocks: (draft.ir as DraftIR).blocks || [],
    goal: draft.goal || "",
    tags: draft.tags?.join(', ') || "",
    campaignId: draft.campaign_id || null
  });

  // 변경사항 확인 함수
  const hasChanges = useCallback(() => {
    return (
      title !== initialValues.current.title ||
      JSON.stringify(blocks) !== JSON.stringify(initialValues.current.blocks) ||
      goal !== initialValues.current.goal ||
      tags !== initialValues.current.tags ||
      campaignId !== initialValues.current.campaignId
    );
  }, [title, blocks, goal, tags, campaignId]);

  const queryClient = useQueryClient();

  const { data: campaigns } = useBffCampaignsListCampaignsApiBffCampaignsGet();

  const { mutate: updateDraft, isPending } = useDraftsUpdateIrApiOrchestratorDraftsDraftIdIrPut({
    mutation: {
      onSuccess: () => {
        initialValues.current = {
          title: title,
          blocks: blocks,
          goal: goal,
          tags: tags,
          campaignId: campaignId
        };
        queryClient.invalidateQueries({ queryKey: getBffDraftsReadDraftApiBffDraftsDraftIdGetQueryKey(draft.id) });
      },
    }
  });

  const { mutate: updateDraftWithCallback } = useDraftsUpdateIrApiOrchestratorDraftsDraftIdIrPut({
    mutation: {
      onSuccess: () => {
        initialValues.current = {
          title: title,
          blocks: blocks,
          goal: goal,
          tags: tags,
          campaignId: campaignId
        };
        queryClient.invalidateQueries({ queryKey: getBffDraftsReadDraftApiBffDraftsDraftIdGetQueryKey(draft.id) });
        onSuccess();
      },
    }
  });

  // Ctrl+S 저장 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!isPending) {
        // Ctrl+S로는 콜백 없이 저장
        const ir: DraftIR = {
          blocks: blocks,
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
      }
    }
  }, [isPending, blocks, title, goal, tags, campaignId, draft.id, updateDraft]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ir: DraftIR = {
      blocks: blocks,
      options: {}
    };
    // 버튼으로는 콜백과 함께 저장
    updateDraftWithCallback({
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 border rounded-lg min-h-[80vh] w-full overflow-y-auto"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {hasChanges() && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>To save changes, press Ctrl+S or click the button below.</span>
        </div>
      )}

      <div className="grid gap-2">
        <label htmlFor="title">Draft Title</label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My new blog post"
        />
      </div>
      <div className="grid gap-2 flex-1">
        <label>Content</label>
        <div
          className="min-h-96 max-h-[60vh] overflow-y-auto border rounded-md p-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <DraftIREditor
            initialBlocks={blocks}
            onBlocksChange={setBlocks}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="goal">Goal (Optional)</label>
        <Textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What is the goal of this draft?"
          className="h-24 resize-none overflow-y-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Ctrl+S to save quickly
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className={`${hasChanges() ? 'bg-primary hover:bg-primary/90' : ''}`}
        >
          {isPending ? "Updating..." : hasChanges() ? "Save Changes" : "Saved"}
        </Button>
      </div>
    </form>
  );
}

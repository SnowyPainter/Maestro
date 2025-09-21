import { useState } from "react";
import {
  useBffDraftsReadDraftApiBffDraftsDraftIdGet,
  useDraftsDeleteApiOrchestratorDraftsDraftIdDelete,
  getBffDraftsListDraftsApiBffDraftsGetQueryKey,
  getBffDraftsListVariantsApiBffDraftsDraftIdVariantsGetQueryKey,
  getBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGetQueryKey
} from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { components } from "@/lib/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { EditDraftForm } from "@/features/drafts/components/EditDraftForm";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { DraftIR } from "@/lib/api/generated";
import { DraftIRBlockRender } from "@/components/Draft/DraftIRBlockRender";
import { DraftVariantList } from "./DraftVariantList";
import { DraftVariantDetail } from "./DraftVariantDetail";
import type { DraftVariantRenderDetail } from "@/lib/api/generated";

export function DraftDetail({ draftId, onDelete }: { draftId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<DraftVariantRenderDetail | null>(null);
  const queryClient = useQueryClient();
  const { data: draft, isLoading, isError } = useBffDraftsReadDraftApiBffDraftsDraftIdGet(draftId);

  const { mutate: deleteDraft, isPending: isDeleting } = useDraftsDeleteApiOrchestratorDraftsDraftIdDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffDraftsListDraftsApiBffDraftsGetQueryKey() });
        onDelete();
      },
    }
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !draft) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load draft details.</p>
        </CardContent>
      </Card>
    );
  }

  const handleDelete = () => {
    deleteDraft({ draftId });
  };

  const handleVariantSelect = (variant: DraftVariantRenderDetail) => {
    setSelectedVariant(variant);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle>{draft.title || "Untitled Draft"}</CardTitle>
            <Badge variant="outline">{draft.state}</Badge>
        </div>
        <CardDescription>{draft.goal || "No goal specified."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
            <h4 className="font-semibold text-sm mb-2">Content</h4>
            <DraftIRBlockRender
                blocks={(draft.ir as DraftIR).blocks}
                compact={true}
                showExpand={(draft.ir as DraftIR).blocks.length > 2}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
            />
        </div>
        {draft.tags && draft.tags.length > 0 && (
            <div>
                <h4 className="font-semibold text-sm mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                    {draft.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
            </div>
        )}
        <div>
            <h4 className="font-semibold text-sm mb-2">Platform Variants</h4>
            <DraftVariantList draftId={draft.id} onSelect={handleVariantSelect} compact={true} />
        </div>
        <div className="text-xs text-muted-foreground pt-4">
            Created: {new Date(draft.created_at).toLocaleString()} | Last Updated: {new Date(draft.updated_at).toLocaleString()}
        </div>
      </CardContent>

      {/* Variant Detail Modal */}
      <Dialog open={!!selectedVariant} onOpenChange={(open) => !open && setSelectedVariant(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Variant Detail</DialogTitle>
          </DialogHeader>
          {selectedVariant && (
            <DraftVariantDetail
              draftId={draft.id}
              platform={String(selectedVariant.platform)}
            />
          )}
        </DialogContent>
      </Dialog>

      <CardFooter className="flex justify-end gap-2">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Draft</DialogTitle>
                </DialogHeader>
                <EditDraftForm draft={draft} onSuccess={() => {
                  setIsEditing(false);
                  queryClient.invalidateQueries({
                    queryKey: getBffDraftsListVariantsApiBffDraftsDraftIdVariantsGetQueryKey(draftId)
                  });
                  queryClient.invalidateQueries({
                    predicate: (query) => {
                      const queryKey = query.queryKey;
                      return Array.isArray(queryKey) &&
                             queryKey.length >= 2 &&
                             queryKey[0] === '/api/bff/drafts' &&
                             queryKey[1] === draftId &&
                             queryKey[2] === 'variants';
                    }
                  });
                }} />
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
                draft and all its associated data.
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

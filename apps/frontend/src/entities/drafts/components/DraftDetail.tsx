import { useState } from "react";
import {
  useBffDraftsReadDraftApiBffDraftsDraftIdGet,
  useDraftsDeleteApiOrchestratorDraftsDraftIdDelete,
  getBffDraftsListDraftsApiBffDraftsGetQueryKey
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
import { DraftIR, DraftIRBlocksItem, DraftIROptions, BlockText, BlockImage, BlockVideo } from "@/lib/api/generated";

function renderBlock(block: DraftIR['blocks'][0], index: number) {
    switch (block.type) {
        case 'text':
            const textProps = block.props as { markdown?: string; mentions?: any[] };
            return (
                <div key={index} className="text-sm text-muted-foreground prose prose-sm max-w-none">
                    {textProps.markdown && (
                        <div dangerouslySetInnerHTML={{ __html: textProps.markdown }} />
                    )}
                </div>
            );

        case 'image':
            const imageProps = block.props as { asset_id?: number; alt?: string; crop?: string };
            return (
                <div key={index} className="my-4">
                    {imageProps.asset_id ? (
                        <img
                            src={`/api/assets/${imageProps.asset_id}`}
                            alt={imageProps.alt || "Draft image"}
                            className="max-w-full h-auto rounded-lg shadow-sm"
                            style={{
                                aspectRatio: imageProps.crop ? imageProps.crop.replace(':', '/') : 'auto'
                            }}
                        />
                    ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Image placeholder
                        </div>
                    )}
                </div>
            );

        case 'video':
            const videoProps = block.props as { asset_id?: number; caption?: string; ratio?: string };
            return (
                <div key={index} className="my-4">
                    {videoProps.asset_id ? (
                        <div>
                            <video
                                controls
                                className="max-w-full h-auto rounded-lg shadow-sm"
                                style={{
                                    aspectRatio: videoProps.ratio ? videoProps.ratio.replace(':', '/') : '16/9'
                                }}
                            >
                                <source src={`/api/assets/${videoProps.asset_id}`} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            {videoProps.caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    {videoProps.caption}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Video placeholder
                        </div>
                    )}
                </div>
            );

        default:
            const unknownBlock = block as { type: string; props: any };
            return (
                <div key={index} className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    Unsupported block type: {unknownBlock.type}
                </div>
            );
    }
}

export function DraftDetail({ draftId, onDelete }: { draftId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
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
            {(draft.ir as DraftIR).blocks.map(renderBlock)}
        </div>
        {draft.tags && draft.tags.length > 0 && (
            <div>
                <h4 className="font-semibold text-sm mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                    {draft.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
            </div>
        )}
        <div className="text-xs text-muted-foreground pt-4">
            Created: {new Date(draft.created_at).toLocaleString()} | Last Updated: {new Date(draft.updated_at).toLocaleString()}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Draft</DialogTitle>
                </DialogHeader>
                <EditDraftForm draft={draft} onSuccess={() => setIsEditing(false)} />
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
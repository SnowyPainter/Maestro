import { useState } from "react";
import { useBffDraftsReadDraftApiBffDraftsDraftIdGet } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { components } from "@/lib/types/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditDraftForm } from "@/features/drafts/components/EditDraftForm";
import { Badge } from "@/components/ui/badge";

type DraftIR = components["schemas"]["DraftIR"];

function renderBlock(block: DraftIR['blocks'][0], index: number) {
    if (block.type === 'text') {
        return <p key={index} className="text-sm text-muted-foreground">{(block.props as any).content}</p>
    }
    // Add other block types here later
    return null;
}

export function DraftDetail({ draftId, onDelete }: { draftId: number, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const { data: draft, isLoading, isError } = useBffDraftsReadDraftApiBffDraftsDraftIdGet(draftId);

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
      </CardFooter>
    </Card>
  );
}
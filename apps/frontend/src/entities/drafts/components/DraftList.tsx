import { useState } from "react";
import { useBffDraftsListDraftsApiBffDraftsGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

export function DraftList({ onSelectDraft }: { onSelectDraft: (draftId: number) => void }) {
  const { data: drafts, isLoading, isError } = useBffDraftsListDraftsApiBffDraftsGet();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return <p className="p-2 text-sm text-destructive">Failed to load drafts.</p>;
  }

  const visibleDrafts = isExpanded ? drafts : drafts?.slice(0, 3);

  return (
    <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Select a Draft</h3>
        <div className="flex flex-col gap-1">
            {visibleDrafts?.map(draft => (
                <button 
                    key={draft.id} 
                    onClick={() => onSelectDraft(draft.id)}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-sm text-left"
                >
                    <ChevronRight className="w-4 h-4" />
                    <span>{draft.title || "Untitled Draft"}</span>
                </button>
            ))}
        </div>
        {drafts && drafts.length > 3 && (
            <Button variant="link" onClick={() => setIsExpanded(!isExpanded)} className="mt-2">
                {isExpanded ? "Show Less" : `Show ${drafts.length - 3} More`}
                {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
        )}
        {drafts?.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">No drafts found.</p>
        )}
    </div>
  );
}

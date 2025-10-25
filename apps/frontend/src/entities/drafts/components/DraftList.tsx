import { useState, useEffect } from "react";
import { useBffDraftsListDraftsApiBffDraftsGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Target, Clock, Zap } from "lucide-react";
import { usePersonaContextStore } from "@/store/persona-context";
import { useContextRegistryStore } from "@/store/chat-context-registry";

export function DraftList({ onSelectDraft }: { onSelectDraft: (draftId: number) => void }) {
  const { data: drafts, isLoading, isError } = useBffDraftsListDraftsApiBffDraftsGet({
    limit: 100, // 더 많은 draft를 가져와서 서제스트에 등록
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const setDraftContext = usePersonaContextStore((state) => state.setDraftContext);
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  // Register drafts in context registry
  useEffect(() => {
    if (drafts) {
      drafts.forEach((draft) => {
        registerEmission('draft_id', {
          value: draft.id.toString(),
          label: draft.title || `Draft #${draft.id}`,
        });
      });
    }
  }, [drafts, registerEmission]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'draft': return 'bg-yellow-400';
      case 'published': return 'bg-green-400';
      case 'archived': return 'bg-gray-400';
      case 'deleted': return 'bg-red-400';
      default: return 'bg-blue-400';
    }
  };

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return <p className="p-2 text-sm text-destructive">Failed to load drafts.</p>;
  }

  // Separate active and deleted drafts, then reorder with deleted items at the end
  const sortedDrafts = drafts ? [
    ...drafts.filter(draft => draft.state.toLowerCase() !== 'deleted'),
    ...drafts.filter(draft => draft.state.toLowerCase() === 'deleted')
  ] : [];

  const visibleDrafts = isExpanded ? sortedDrafts : sortedDrafts.slice(0, 3);

  return (
    <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Select a Draft</h3>
        <div className="flex flex-col gap-2">
            {visibleDrafts?.map(draft => (
                <button
                    key={draft.id}
                    onClick={() => onSelectDraft(draft.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 text-left group transition-colors ${
                        draft.state.toLowerCase() === 'deleted' ? 'line-through opacity-60' : ''
                    }`}
                >
                    <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                                {draft.title || "Untitled Draft"}
                            </span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                                #{draft.id}
                            </Badge>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`w-2 h-2 rounded-full ${getStateColor(draft.state)}`}></span>
                                <span className="text-xs text-muted-foreground capitalize">{draft.state}</span>
                            </div>
                        </div>
                        {draft.goal && (
                            <div className="flex items-start gap-2 mb-2">
                                <Target className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <p className="text-xs text-muted-foreground line-clamp-2 relative">
                                    {draft.goal}
                                    {draft.goal.length > 80 && (
                                        <span className="absolute right-0 bottom-0 w-8 h-4 bg-gradient-to-l from-background to-transparent"></span>
                                    )}
                                </p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>Created {formatDate(draft.created_at)}</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDraftContext(draft.id);
                        }}
                    >
                        <Zap className="h-3 w-3" />
                    </Button>
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

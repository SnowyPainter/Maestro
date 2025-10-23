import { useState, useEffect } from "react";
import { useBffPlaybookListPlaybooksApiBffPlaybooksGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Clock, Palette, Hash } from "lucide-react";
import { useContextRegistryStore } from "@/store/chat-context-registry";

export function PlaybookList({ onSelectPlaybook }: { onSelectPlaybook: (playbookId: number) => void }) {
  const { data: playbooks, isLoading, isError } = useBffPlaybookListPlaybooksApiBffPlaybooksGet();
  const [isExpanded, setIsExpanded] = useState(false);
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  // Register playbooks in context registry
  useEffect(() => {
    if (playbooks?.items) {
      playbooks.items.forEach((playbook) => {
        registerEmission('playbook_id', {
          value: playbook.id.toString(),
          label: `Playbook ${playbook.id}`,
        });
      });
    }
  }, [playbooks, registerEmission]);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return <p className="p-2 text-sm text-destructive">Failed to load playbooks.</p>;
  }

  const visiblePlaybooks = isExpanded ? playbooks?.items : playbooks?.items?.slice(0, 3);

  return (
    <div className="p-4 border rounded-lg bg-card">
        <h3 className="font-semibold mb-4 text-foreground">Select a Playbook</h3>
        <div className="space-y-3">
            {visiblePlaybooks?.map(playbook => (
                <div key={playbook.id} className="p-4 rounded-lg bg-background border hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                                <h4 className="font-semibold text-foreground">Playbook {playbook.id}</h4>
                                {playbook.last_event && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                                        {playbook.last_event}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign</span>
                                    </div>
                                    <p className="font-medium text-foreground text-sm">{playbook.campaign_name}</p>
                                    {playbook.campaign_description && (
                                        <p className="text-xs text-muted-foreground truncate">{playbook.campaign_description}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Persona</span>
                                    </div>
                                    <p className="font-medium text-foreground text-sm">{playbook.persona_name}</p>
                                    {playbook.persona_bio && (
                                        <p className="text-xs text-muted-foreground truncate">{playbook.persona_bio}</p>
                                    )}
                                </div>
                            </div>

                            {(playbook.best_time_window || playbook.best_tone || (playbook.top_hashtags && playbook.top_hashtags.length > 0)) && (
                                <div className="flex flex-wrap gap-3 pt-3 border-t border-border/50">
                                    {playbook.best_time_window && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            <span>{playbook.best_time_window}</span>
                                        </div>
                                    )}
                                    {playbook.best_tone && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Palette className="w-3 h-3" />
                                            <span>{playbook.best_tone}</span>
                                        </div>
                                    )}
                                    {playbook.top_hashtags && playbook.top_hashtags.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Hash className="w-3 h-3" />
                                            <span>{playbook.top_hashtags.slice(0, 2).join(' #')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <Button
                            size="sm"
                            onClick={() => onSelectPlaybook(playbook.id)}
                            className="ml-4 shrink-0"
                        >
                            Select
                        </Button>
                    </div>
                </div>
            ))}
        </div>
        {playbooks?.items && playbooks.items.length > 3 && (
            <Button variant="link" onClick={() => setIsExpanded(!isExpanded)} className="mt-2">
                {isExpanded ? "Show Less" : `Show ${playbooks.items.length - 3} More`}
                {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
        )}
        {playbooks?.items?.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">No playbooks found.</p>
        )}
    </div>
  );
}

import { useState } from "react";
import { useBffAccountsListPersonasApiBffAccountsPersonasGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";

export function PersonaList({ onSelectPersona }: { onSelectPersona: (personaId: number) => void }) {
  const { data: personas, isLoading, isError } = useBffAccountsListPersonasApiBffAccountsPersonasGet();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (isError) {
    return <p className="p-2 text-sm text-destructive">Failed to load personas.</p>;
  }

  const visiblePersonas = isExpanded ? personas : personas?.slice(0, 3);

  return (
    <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-3">Select a Persona</h3>
        <div className="grid grid-cols-2 gap-3">
            {visiblePersonas?.map(persona => (
                <button
                    key={persona.id}
                    onClick={() => onSelectPersona(persona.id)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 text-left group transition-colors"
                >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                        {persona.avatar_url && (
                            <AvatarImage src={persona.avatar_url} alt={persona.name} />
                        )}
                        <AvatarFallback className="text-xs">
                            {persona.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{persona.name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                                #{persona.id}
                            </Badge>
                        </div>
                        {persona.bio && (
                            <p className="text-xs text-muted-foreground mb-1 line-clamp-1 truncate">
                                {persona.bio}
                            </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {persona.language && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    {persona.language.toUpperCase()}
                                </span>
                            )}
                            {persona.tone && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                    {persona.tone}
                                </span>
                            )}
                        </div>
                    </div>
                </button>
            ))}
        </div>
        {personas && personas.length > 3 && (
            <Button variant="link" onClick={() => setIsExpanded(!isExpanded)} className="mt-3 col-span-2">
                {isExpanded ? "Show Less" : `Show ${personas.length - 3} More`}
                {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </Button>
        )}
        {personas?.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground col-span-2">No personas found.</p>
        )}
    </div>
  );
}

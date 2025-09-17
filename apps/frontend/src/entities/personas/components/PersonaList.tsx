import { useState } from "react";
import { useBffAccountsListPersonasApiBffAccountsPersonasGet } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

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
        <h3 className="font-semibold mb-2">Select a Persona</h3>
        <div className="flex flex-col gap-1">
            {visiblePersonas?.map(persona => (
                <button 
                    key={persona.id} 
                    onClick={() => onSelectPersona(persona.id)}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-sm text-left"
                >
                    <ChevronRight className="w-4 h-4" />
                    <span>{persona.name}</span>
                </button>
            ))}
        </div>
        {personas && personas.length > 3 && (
            <Button variant="link" onClick={() => setIsExpanded(!isExpanded)} className="mt-2">
                {isExpanded ? "Show Less" : `Show ${personas.length - 3} More`}
                {isExpanded ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
        )}
        {personas?.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">No personas found.</p>
        )}
    </div>
  );
}

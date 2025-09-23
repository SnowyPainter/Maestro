import { useEffect } from "react";
import { useBffAccountsListPersonasApiBffAccountsPersonasGet, PersonaOut } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, WifiOff } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useContextRegistryStore } from "@/store/chat-context-registry";

interface PersonaListProps {
  onSelectPersona: (personaId: number) => void;
}

export function PersonaList({ onSelectPersona }: PersonaListProps) {
  const { data: personas, isLoading, isError } = useBffAccountsListPersonasApiBffAccountsPersonasGet();
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  // Register personas in context registry
  useEffect(() => {
    if (personas) {
      personas.forEach((persona) => {
        registerEmission('persona_id', {
          value: persona.id.toString(),
          label: persona.name,
        });
      });
    }
  }, [personas, registerEmission]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-md p-8">
        <WifiOff className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-destructive">Failed to load personas</h3>
        <p className="text-muted-foreground text-sm mt-2">An unexpected error occurred.</p>
      </div>
    );
  }

  if (!personas || personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-md p-8">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Personas Found</h3>
        <p className="text-muted-foreground text-sm mt-2">There are no personas to display yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {personas.map((persona: PersonaOut) => (
        <Card key={persona.id} onClick={() => onSelectPersona(persona.id)} className="cursor-pointer rounded-2xl border bg-card text-card-foreground shadow-md hover:bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                {persona.avatar_url && <AvatarImage src={persona.avatar_url} alt={persona.name} />}
                <AvatarFallback className="text-xs">{persona.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <CardTitle className="text-sm font-medium">{persona.name}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">#{persona.id}</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground line-clamp-2">{persona.bio || "No bio available."}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

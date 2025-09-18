import { useState, useEffect } from "react";
import { useAccountsLinkCreateApiOrchestratorAccountsPersonaAccountLinksPost, useBffAccountsListPersonasApiBffAccountsPersonasGet, useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet, PlatformAccountOut } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { PersonaBadge } from "@/entities/personas/components/PersonaBadge";
import { useQueryClient } from "@tanstack/react-query";

interface LinkPersonaFormProps {
  account: PlatformAccountOut;
}

export function LinkPersonaForm({ account }: LinkPersonaFormProps) {
  const queryClient = useQueryClient();
  const { data: personas } = useBffAccountsListPersonasApiBffAccountsPersonasGet();
  const { data: linkedPersonas, refetch } = useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet(account.id);

  const [selectedPersonaId, setSelectedPersonaId] = useState<number | undefined>();

  useEffect(() => {
    if (personas && personas.length > 0) {
      setSelectedPersonaId(personas[0].id);
    }
  }, [personas]);

  const { mutate: linkPersona, isPending } = useAccountsLinkCreateApiOrchestratorAccountsPersonaAccountLinksPost({
    mutation: {
      onSuccess: () => {
        refetch();
      }
    }
  });

  const handleLink = () => {
    if (selectedPersonaId) {
      linkPersona({ data: { link: { persona_id: selectedPersonaId, account_id: account.id } } });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium">Linked Personas</h4>
        <div className="flex flex-wrap gap-2 mt-2">
          {linkedPersonas?.map(link => <PersonaBadge key={link.id} personaId={link.persona_id} />)}
          {linkedPersonas?.length === 0 && <p className="text-sm text-muted-foreground">No personas linked yet.</p>}
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">Link New Persona</h4>
        <div className="flex gap-2">
          <select 
            value={selectedPersonaId}
            onChange={e => setSelectedPersonaId(Number(e.target.value))}
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
          >
            {personas?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={handleLink} disabled={isPending || !selectedPersonaId}>
            Link
          </Button>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useAccountsLinkCreateApiOrchestratorAccountsPersonaAccountLinksPost, useBffAccountsListPersonasApiBffAccountsPersonasGet, useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LinkPersonaToAccountCard({ onSuccess }: { onSuccess?: () => void }) {
  const { data: personas, isLoading: isLoadingPersonas } = useBffAccountsListPersonasApiBffAccountsPersonasGet();
  const { data: accounts, isLoading: isLoadingAccounts } = useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet();
  
  const [personaId, setPersonaId] = useState<number | undefined>();
  const [accountId, setAccountId] = useState<number | undefined>();

  useEffect(() => {
    if (personas && personas.length > 0) {
      setPersonaId(personas[0].id);
    }
  }, [personas]);

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  const { mutate: linkAccount, isPending, error } = useAccountsLinkCreateApiOrchestratorAccountsPersonaAccountLinksPost({
    mutation: {
      onSuccess: () => {
        onSuccess?.();
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personaId && accountId) {
      linkAccount({ data: { link: { persona_id: personaId, account_id: accountId } } });
    }
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Link Persona to Account</CardTitle>
        <CardDescription>Associate a persona with a platform account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="persona_id">Persona</label>
            <select id="persona_id" value={personaId} onChange={e => setPersonaId(Number(e.target.value))} className="h-10 w-full rounded-xl border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" disabled={isLoadingPersonas}>
              {personas?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="account_id">Account</label>
            <select id="account_id" value={accountId} onChange={e => setAccountId(Number(e.target.value))} className="h-10 w-full rounded-xl border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" disabled={isLoadingAccounts}>
              {accounts?.map(a => <option key={a.id} value={a.id}>{a.handle} (@{a.platform})</option>)}
            </select>
          </div>

        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-end">
          <Button type="submit" disabled={isPending || isLoadingPersonas || isLoadingAccounts || !personaId || !accountId}>
            {isPending ? "Linking..." : "Link Account"}
          </Button>
        </CardFooter>
      </form>
      {error && <div className="text-destructive p-4">{(error as any).detail?.[0]?.msg || 'An error occurred'}</div>}
    </Card>
  );
}

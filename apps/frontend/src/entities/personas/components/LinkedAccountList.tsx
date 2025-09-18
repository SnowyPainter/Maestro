import { useBffAccountsListAccountsForPersonaApiBffAccountsPersonasPersonaIdAccountsGet } from "@/lib/api/generated";
import { PersonaAccountCard } from "@/entities/accounts/components/PersonaAccountCard";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkedAccountListProps {
  personaId: number;
}

export function LinkedAccountList({ personaId }: LinkedAccountListProps) {
  const { data: links, isLoading, refetch } = useBffAccountsListAccountsForPersonaApiBffAccountsPersonasPersonaIdAccountsGet(personaId);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Linked Accounts</h3>
      {links?.map(link => <PersonaAccountCard key={link.id} link={link} refetchLinks={refetch} />)}
      {links?.length === 0 && <p className="text-center text-muted-foreground">No accounts linked to this persona.</p>}
    </div>
  );
}

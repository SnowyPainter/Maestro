import { useBffAccountsListAccountsForPersonaApiBffAccountsPersonasPersonaIdAccountsGet } from "@/lib/api/generated";
import { PersonaAccountCard } from "@/entities/accounts/components/PersonaAccountCard";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkedAccountListProps {
  personaId: number;
}

export function LinkedAccountList({ personaId }: LinkedAccountListProps) {
  const { data: links, isLoading, refetch } = useBffAccountsListAccountsForPersonaApiBffAccountsPersonasPersonaIdAccountsGet(personaId);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Linked Accounts</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {links?.length || 0}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {links?.map(link => <PersonaAccountCard key={link.id} link={link} refetchLinks={refetch} />)}
      </div>
      {links?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No accounts linked to this persona.</p>
        </div>
      )}
    </div>
  );
}

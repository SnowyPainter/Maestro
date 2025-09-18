import { PersonaAccountList as PersonaAccountListType, useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet } from "@/lib/api/generated";
import { PersonaAccountCard } from "./PersonaAccountCard";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonaAccountListProps {
  accountId?: number;
  palist?: PersonaAccountListType;
}

export function PersonaAccountList({ accountId, palist }: PersonaAccountListProps) {
  const { data: fetchedLinks, isLoading, refetch } = useBffAccountsListPersonasForAccountApiBffAccountsPlatformAccountIdPersonasGet(
    accountId!,
    {
      query: {
        enabled: !!accountId && !palist
      }
    }
  );

  const links = palist || fetchedLinks;

  if (isLoading && !palist) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {links?.map(link => <PersonaAccountCard key={link.id} link={link} refetchLinks={refetch} />)}
      {links?.length === 0 && <p className="text-center text-muted-foreground">No persona links for this account.</p>}
    </div>
  );
}

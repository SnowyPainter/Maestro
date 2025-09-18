
import { useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet } from "@/lib/api/generated";
import { PlatformAccountOut } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, WifiOff } from "lucide-react";

interface AccountListProps {
  onSelectAccount?: (accountId: number) => void;
}

export function AccountList({ onSelectAccount }: AccountListProps) {
  const { data: accounts, isLoading, isError, error } = useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet();

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
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
        <h3 className="text-lg font-semibold text-destructive">Failed to load accounts</h3>
        <p className="text-muted-foreground text-sm mt-2">{error?.detail?.[0]?.msg || "An unexpected error occurred."}</p>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card text-card-foreground shadow-md p-8">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Accounts Found</h3>
        <p className="text-muted-foreground text-sm mt-2">There are no accounts to display yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account: PlatformAccountOut) => (
        <Card key={account.id} onClick={() => onSelectAccount?.(account.id)} className="cursor-pointer rounded-2xl border bg-card text-card-foreground shadow-md hover:bg-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{account.handle}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{account.id}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{account.platform}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">@{account.handle}</div>
            <p className="text-xs text-muted-foreground">{account.bio || "No bio available."}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

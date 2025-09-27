
import { useEffect } from "react";
import {
  useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet,
  useAccountsPlatformRestoreApiOrchestratorAccountsPlatformRestorePost,
} from "@/lib/api/generated";
import { PlatformAccountOut } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, WifiOff, Ban, RotateCw } from "lucide-react";
import { useContextRegistryStore } from "@/store/chat-context-registry";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface AccountListProps {
  onSelectAccount?: (accountId: number) => void;
}

export function AccountList({ onSelectAccount }: AccountListProps) {
  const queryClient = useQueryClient();
  const {
    data: accounts,
    isLoading,
    isError,
    error,
  } = useBffAccountsListPlatformAccountsApiBffAccountsPlatformGet();
  const registerEmission = useContextRegistryStore((state) => state.registerEmission);

  const restoreAccountMutation = useAccountsPlatformRestoreApiOrchestratorAccountsPlatformRestorePost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["bff-accounts", "listPlatformAccountsApiBffAccountsPlatformGet"],
        });
      },
    },
  });

  // Register accounts and platforms in context registry
  useEffect(() => {
    if (accounts) {
      const platforms = new Set<string>();
      accounts.forEach((account) => {
        // Register account_id
        registerEmission("account_id", {
          value: account.id.toString(),
          label: `@${account.handle}`,
        });

        // Collect unique platforms
        platforms.add(account.platform);
      });

      // Register platforms
      platforms.forEach((platform) => {
        registerEmission("platform", {
          value: platform,
          label: platform.charAt(0).toUpperCase() + platform.slice(1),
        });
      });
    }
  }, [accounts, registerEmission]);

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
        <Card
          key={account.id}
          onClick={() => account.is_active !== false && onSelectAccount?.(account.id)}
          className={`rounded-2xl border bg-card text-card-foreground shadow-md relative ${
            account.is_active !== false && "cursor-pointer hover:bg-muted"
          }`}
        >
          <div className={account.is_active === false ? "opacity-40" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {account.is_active === false && <Ban className="w-4 h-4" />}
                {account.handle}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">#{account.id}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{account.platform}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">@{account.handle}</div>
              <p className="text-xs text-muted-foreground">{account.bio || "No bio available."}</p>
            </CardContent>
          </div>
          {account.is_active === false && (
            <div className="absolute inset-0 bg-background/30 flex items-center justify-center rounded-2xl">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  restoreAccountMutation.mutate({ data: { account_id: account.id } });
                }}
                disabled={restoreAccountMutation.isPending}
              >
                <RotateCw className={`w-4 h-4 mr-2 ${restoreAccountMutation.isPending ? "animate-spin" : ""}`} />
                {restoreAccountMutation.isPending ? "Restoring..." : "Restore"}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

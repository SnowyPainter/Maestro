import { useBffCoworkerReadLeaseApiBffCoworkerLeaseGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const StatusIndicator = ({ active }: { active: boolean }) => (
  <div className={cn("w-3 h-3 rounded-full", active ? "bg-success" : "bg-muted-foreground/50")} />
);

export function CoWorkerDetail() {
  const { data: lease, isLoading, error } = useBffCoworkerReadLeaseApiBffCoworkerLeaseGet();

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (error || !lease) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{(error as any)?.message || "Could not load CoWorker details."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIndicator active={lease.active} />
          CoWorker Status
        </CardTitle>
        <CardDescription>
          {lease.has_lease ? "A lease is currently held and active." : "No active lease."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
          <span className="text-muted-foreground">Polling Interval</span>
          <span>{lease.interval_seconds} seconds</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
          <span className="text-muted-foreground">Task ID</span>
          <Badge variant="outline" className="font-mono">{lease.task_id || "N/A"}</Badge>
        </div>
        <div>
          <h4 className="font-medium mb-2 text-base">Monitored Persona Accounts</h4>
          <div className="space-y-2">
            {lease.persona_accounts.map(pa => (
              <div key={pa.persona_account_id} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={pa.avatar_url || undefined} alt={pa.persona_name || 'avatar'} />
                  <AvatarFallback>{pa.persona_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{pa.persona_name}</p>
                  <p className="text-xs text-muted-foreground">{pa.handle} on {pa.platform}</p>
                </div>
              </div>
            ))}
             {lease.persona_accounts.length === 0 && <p className="text-sm text-muted-foreground p-2">No persona accounts are being monitored.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
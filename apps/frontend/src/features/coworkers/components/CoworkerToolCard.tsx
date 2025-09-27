import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    useBffCoworkerReadLeaseApiBffCoworkerLeaseGet, 
    CoworkerLeaseState
} from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Zap, ZapOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoworkerActivity } from "@/entities/coworkers/components/CoworkerActivity";

interface CoworkerToolCardProps {
  onViewDetails: () => void;
  onEdit: (lease: CoworkerLeaseState) => void;
}

export function CoworkerToolCard({ onViewDetails, onEdit }: CoworkerToolCardProps) {
  const { data: lease, isLoading, error, refetch } = useBffCoworkerReadLeaseApiBffCoworkerLeaseGet();

  if (isLoading) {
    return <Skeleton className="h-60 w-full rounded-2xl" />;
  }

  if (error || !lease) {
    return (
      <Card className="rounded-2xl border-destructive">
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{(error as any)?.message || "Could not load CoWorker status."}</CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const isActive = lease.active && lease.has_lease;

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md overflow-hidden">
      <div className="flex">
        <div className={cn(
            "w-28 flex items-center justify-center bg-muted/30 transition-colors duration-300",
            isActive && "bg-success/10"
        )}>
          <Bot className={cn(
              "h-14 w-14 text-muted-foreground/40 transition-colors duration-300",
              isActive && "text-success"
          )} />
        </div>
        <div className="flex-1 p-6">
            <CardTitle className="flex items-center gap-2 font-semibold">
              CoWorker
            </CardTitle>
            <CardDescription className="mt-1">Your automated assistant.</CardDescription>
            
            <div className="flex items-center gap-2 my-4">
                {isActive ? <Zap className="h-5 w-5 text-success" /> : <ZapOff className="h-5 w-5 text-muted-foreground" />}
                <p className="text-sm font-medium">
                    {isActive ? `Monitoring ${lease.persona_account_ids.length} accounts.` : "Currently inactive."}
                </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onViewDetails}>
                Details
              </Button>
              <Button size="sm" onClick={() => onEdit(lease)}>
                {isActive ? "Adjust" : "Setup"}
              </Button>
            </div>
        </div>
      </div>
      <div className="border-t">
        <CoworkerActivity personaAccountIds={isActive ? lease.persona_account_ids : []} />
      </div>
    </Card>
  );
}
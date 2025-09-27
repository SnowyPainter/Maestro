
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    useBffCoworkerReadLeaseApiBffCoworkerLeaseGet, 
    CoworkerLeaseState,
    getBffScheduleListSchedulesApiBffSchedulesGetQueryOptions,
    ScheduleListItem,
    ScheduleStatus
} from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Zap, ZapOff, Clock, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Ban, CircleDashed, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isPast, isToday, isFuture } from 'date-fns';
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const parseUtcDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    if (dateString.endsWith('Z') || /[-+]\d{2}:\d{2}$/.test(dateString)) {
        return new Date(dateString);
    }
    return new Date(dateString + 'Z');
};

const StatusDisplay = ({ status, dueDate }: { status: ScheduleStatus, dueDate: Date | null }) => {
    const isOverdue = dueDate && isPast(dueDate) && status === 'pending';
    const statusMap: Record<ScheduleStatus, { icon: React.ReactNode; color: string; label: string }> = {
        pending: { icon: isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-amber-500" />, color: isOverdue ? "text-red-500" : "text-amber-500", label: isOverdue ? "Overdue" : "Pending" },
        enqueued: { icon: <CircleDashed className="h-4 w-4 text-blue-500" />, color: "text-blue-500", label: "Enqueued" },
        running: { icon: <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />, color: "text-indigo-500", label: "Running" },
        done: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, color: "text-green-500", label: "Done" },
        failed: { icon: <AlertCircle className="h-4 w-4 text-red-700" />, color: "text-red-700", label: "Failed" },
        cancelled: { icon: <Ban className="h-4 w-4 text-muted-foreground" />, color: "text-muted-foreground", label: "Cancelled" },
    };
    const currentStatus = statusMap[status] || { icon: <HelpCircle className="h-4 w-4" />, color: "", label: status };
    return (
        <div className={cn("flex items-center gap-1.5 text-xs", currentStatus.color)}>
            {currentStatus.icon}
            <span className="capitalize font-medium">{currentStatus.label}</span>
        </div>
    );
};

const WorklogItem = ({ item }: { item: ScheduleListItem }) => {
    const updatedAt = parseUtcDate(item.updated_at);
    return (
        <div className="flex items-start gap-3 py-2.5 px-2 hover:bg-muted/50 rounded-lg">
            <div className="w-24 flex-shrink-0 pt-0.5">
                <StatusDisplay status={item.status as ScheduleStatus} dueDate={parseUtcDate(item.due_at)} />
            </div>
            <div className="flex-1 grid gap-0.5">
                <p className="font-medium text-sm leading-tight text-foreground truncate">{item.meta?.label || `Schedule #${item.id}`}</p>
                {item.status === 'failed' && item.last_error && (
                    <p className="text-xs text-red-600 truncate">Error: {item.last_error}</p>
                )}
            </div>
            <div className="text-right pt-0.5">
                {updatedAt && (
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(updatedAt, { addSuffix: true })}
                    </p>
                )}
            </div>
        </div>
    )
}

const CoworkerActivity = ({ personaAccountIds }: { personaAccountIds: number[] }) => {
    const scheduleQueries = useQueries({
        queries: (personaAccountIds || []).map(id => 
            getBffScheduleListSchedulesApiBffSchedulesGetQueryOptions({ persona_account_id: id, limit: 50 })
        ),
    });

    const isLoading = scheduleQueries.some(q => q.isLoading);

    const { running, today, upcoming, past } = useMemo(() => {
        if (isLoading) return { running: [], today: [], upcoming: [], past: [] };

        const allSchedules = scheduleQueries.flatMap(q => q.data?.items || []);
        
        const running: ScheduleListItem[] = [];
        const today: ScheduleListItem[] = [];
        const upcoming: ScheduleListItem[] = [];
        const past: ScheduleListItem[] = [];

        allSchedules.forEach(item => {
            if (item.status === 'running') {
                running.push(item);
            } else if (item.status === 'done' || item.status === 'failed' || item.status === 'cancelled') {
                past.push(item);
            } else if (item.status === 'pending' || item.status === 'enqueued') {
                const dueDate = parseUtcDate(item.due_at);
                if (dueDate) {
                    if (isToday(dueDate) || isPast(dueDate)) {
                        today.push(item); // Overdue items are shown in Today
                    } else if (isFuture(dueDate)) {
                        upcoming.push(item);
                    }
                } else {
                    upcoming.push(item); // No due date, considered upcoming
                }
            }
        });

        const sortByDate = (a: ScheduleListItem, b: ScheduleListItem) => (parseUtcDate(a.due_at)?.getTime() || 0) - (parseUtcDate(b.due_at)?.getTime() || 0);
        const sortByUpdateDateDesc = (a: ScheduleListItem, b: ScheduleListItem) => (parseUtcDate(b.updated_at)?.getTime() || 0) - (parseUtcDate(a.updated_at)?.getTime() || 0);

        return {
            running: running.sort(sortByDate),
            today: today.sort(sortByDate),
            upcoming: upcoming.sort(sortByDate),
            past: past.sort(sortByUpdateDateDesc).slice(0, 10) // Limit past items
        };
    }, [scheduleQueries, isLoading]);

    

    const renderList = (items: ScheduleListItem[]) => (
        <div className="flow-root">
            <ul className="-my-1 divide-y divide-border">
                {items.map(item => (
                    <li key={item.id}><WorklogItem item={item} /></li>
                ))}
            </ul>
        </div>
    );

    const renderContent = () => {
        if (isLoading && personaAccountIds.length > 0) {
            return <div className="space-y-2 px-4 py-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
        }

        const allEmpty = [running, today, upcoming, past].every(arr => arr.length === 0);
        if (allEmpty) {
            return <p className="text-xs text-muted-foreground text-center py-4">No activity found for monitored accounts.</p>;
        }

        const defaultOpen = ['running', 'today'].filter(key => 
            (key === 'running' && running.length > 0) || (key === 'today' && today.length > 0)
        );

        return (
            <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
                {running.length > 0 && (
                    <AccordionItem value="running">
                        <AccordionTrigger className="px-4 text-sm font-semibold">In Progress <Badge variant="secondary" className="ml-2">{running.length}</Badge></AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">{renderList(running)}</AccordionContent>
                    </AccordionItem>
                )}
                {today.length > 0 && (
                    <AccordionItem value="today">
                        <AccordionTrigger className="px-4 text-sm font-semibold">Today <Badge variant="secondary" className="ml-2">{today.length}</Badge></AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">{renderList(today)}</AccordionContent>
                    </AccordionItem>
                )}
                {upcoming.length > 0 && (
                    <AccordionItem value="upcoming">
                        <AccordionTrigger className="px-4 text-sm font-semibold">Upcoming <Badge variant="outline" className="ml-2">{upcoming.length}</Badge></AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">{renderList(upcoming)}</AccordionContent>
                    </AccordionItem>
                )}
                {past.length > 0 && (
                    <AccordionItem value="past">
                        <AccordionTrigger className="px-4 text-sm font-semibold">Completed <Badge variant="outline" className="ml-2">{past.length}</Badge></AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">{renderList(past)}</AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        );
    }

    return (
        <div className="py-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 px-4">Co-Worker Activity</h4>
            
            {renderContent()}
        </div>
    )
}

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

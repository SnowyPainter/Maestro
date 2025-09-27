import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { formatDistanceToNow, isPast, isToday, isFuture } from 'date-fns';
import { 
    getBffScheduleListSchedulesApiBffSchedulesGetQueryOptions,
    ScheduleListItem,
    ScheduleStatus
} from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Ban, CircleDashed, RefreshCw, Info } from "lucide-react";

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

const KeyValueRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-start text-sm py-1.5 border-b border-border/50">
        <dt className="text-muted-foreground font-medium shrink-0 pr-4">{label}</dt>
        <dd className="text-right text-foreground break-words">{value}</dd>
    </div>
);

const ScheduleMetaDetails = ({ meta }: { meta: any }) => {
    if (!meta) return <p className="text-sm text-muted-foreground">No metadata available.</p>;

    const { label, dag_meta, context, payload } = meta;
    const dagResults = context?._dag?.results;

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div>
                <h4 className="font-semibold mb-2 text-foreground">Summary</h4>
                <dl className="space-y-1">
                    {label && <KeyValueRow label="Type" value={<Badge variant="outline">{label}</Badge>} />}
                    {dag_meta?.title && <KeyValueRow label="Title" value={dag_meta.title} />}
                    {dag_meta?.scheduled_for && <KeyValueRow label="Scheduled For" value={new Date(dag_meta.scheduled_for).toLocaleString()} />}
                </dl>
            </div>

            {/* DAG Status */}
            {context?._dag && (
                 <div>
                    <h4 className="font-semibold mb-2 text-foreground">Automation Status</h4>
                    <dl className="space-y-1">
                        {context._dag.waiting_node && <KeyValueRow label="Current Step" value={<Badge variant="secondary">{context._dag.waiting_node}</Badge>} />}
                        {context._dag.resume_next && <KeyValueRow label="Next Step(s)" value={context._dag.resume_next.join(', ')} />}
                    </dl>
                </div>
            )}

            {/* Payload */}
            {payload && (
                <div>
                    <h4 className="font-semibold mb-2 text-foreground">Parameters</h4>
                    <dl className="space-y-1">
                        {Object.entries(payload).map(([key, value]) => (
                             <KeyValueRow key={key} label={key} value={String(value)} />
                        ))}
                    </dl>
                </div>
            )}

            {/* Results */}
            {dagResults && Object.keys(dagResults).length > 0 && (
                 <div>
                    <h4 className="font-semibold mb-2 text-foreground">Step Results</h4>
                    <Accordion type="single" collapsible className="w-full rounded-md border">
                        {Object.entries(dagResults).map(([key, value]) => (
                            Object.keys(value as object).length > 0 && (
                                <AccordionItem value={key} key={key}>
                                    <AccordionTrigger className="px-3 text-sm">{key}</AccordionTrigger>
                                    <AccordionContent className="px-3 pb-3">
                                        <pre className="text-xs bg-muted rounded-md p-2.5 overflow-x-auto">
                                            {JSON.stringify(value, null, 2)}
                                        </pre>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        ))}
                    </Accordion>
                </div>
            )}

            {/* Raw JSON Fallback */}
            <div className="pt-4">
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="raw">
                        <AccordionTrigger className="text-sm text-muted-foreground">View Raw Metadata</AccordionTrigger>
                        <AccordionContent>
                            <pre className="text-xs bg-muted rounded-md p-2.5 overflow-x-auto">
                                {JSON.stringify(meta, null, 2)}
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}

const WorklogItem = ({ item, onShowDetails }: { item: ScheduleListItem, onShowDetails: () => void }) => {
    const updatedAt = parseUtcDate(item.updated_at);
    const hasMeta = item.meta && Object.keys(item.meta).length > 0;

    return (
        <div className="flex items-start gap-3 py-2.5 px-2 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={hasMeta ? onShowDetails : undefined}>
            <div className="w-24 flex-shrink-0 pt-0.5">
                <StatusDisplay status={item.status as ScheduleStatus} dueDate={parseUtcDate(item.due_at)} />
            </div>
            <div className="flex-1 grid gap-0.5 overflow-hidden">
                <p className="font-medium text-sm leading-tight text-foreground truncate">{item.meta?.label || `Schedule #${item.id}`}</p>
                {item.status === 'failed' && item.last_error && (
                    <p className="text-xs text-red-600 truncate" title={item.last_error}>Error: {item.last_error}</p>
                )}
            </div>
            <div className="flex items-center gap-2 text-right pt-0.5 shrink-0">
                {hasMeta && (
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {updatedAt && (
                    <p className="text-xs text-muted-foreground whitespace-nowrap w-[85px]">
                        {formatDistanceToNow(updatedAt, { addSuffix: true })}
                    </p>
                )}
            </div>
        </div>
    )
}

export const CoworkerActivity = ({ personaAccountIds }: { personaAccountIds: number[] }) => {
    const [detailedItem, setDetailedItem] = useState<ScheduleListItem | null>(null);
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
            past: past.sort(sortByUpdateDateDesc).slice(0, 20) // Limit past items to 20
        };
    }, [scheduleQueries, isLoading]);

    const renderList = (items: ScheduleListItem[]) => (
        <ScrollArea className="h-72">
            <div className="flow-root pr-4">
                <ul className="-my-1 divide-y divide-border">
                    {items.map(item => (
                        <li key={item.id}>
                            <WorklogItem item={item} onShowDetails={() => setDetailedItem(item)} />
                        </li>
                    ))}
                </ul>
            </div>
        </ScrollArea>
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

            <Dialog open={!!detailedItem} onOpenChange={(isOpen) => !isOpen && setDetailedItem(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Schedule Details</DialogTitle>
                        <DialogDescription>
                            Detailed information for schedule #{detailedItem?.id}.
                        </DialogDescription>
                    </DialogHeader>
                    {detailedItem && (
                        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
                           <ScheduleMetaDetails meta={detailedItem.meta} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
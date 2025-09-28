
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActionScheduleCancelSchedulesApiOrchestratorActionsSchedulesCancelPost, ScheduleListItem, ScheduleStatus } from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";
import { 
    Clock, CheckCircle2, CalendarDays, UserCircle, AlertTriangle, 
    ChevronDown, Copy, RefreshCw, XCircle, AlertCircle, HelpCircle, Ban, CircleDashed
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, isFuture, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const parseUtcDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    if (dateString.endsWith('Z') || /[-+]\d{2}:\d{2}$/.test(dateString)) {
        return new Date(dateString);
    }
    return new Date(dateString + 'Z');
};

const JsonViewer = ({ data, title }: { data: any; title: string }) => (
    <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
            <AccordionTrigger className="text-xs font-semibold">{title}</AccordionTrigger>
            <AccordionContent>
                <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </AccordionContent>
        </AccordionItem>
    </Accordion>
);

const StatusDisplay = ({ status, dueDate }: { status: ScheduleStatus, dueDate: Date | null }) => {
    const isOverdue = dueDate && isPast(dueDate) && status === 'pending';

    const STATUS_MAP: Record<ScheduleStatus, { icon: React.ReactNode; color: string; label: string }> = {
        pending: {
            icon: isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-amber-500" />,
            color: isOverdue ? "text-red-500" : "text-amber-500",
            label: isOverdue ? "Overdue" : "Pending",
        },
        enqueued: { icon: <CircleDashed className="h-4 w-4 text-blue-500" />, color: "text-blue-500", label: "Enqueued" },
        running: { icon: <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />, color: "text-indigo-500", label: "Running" },
        done: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, color: "text-green-500", label: "Done" },
        failed: { icon: <AlertCircle className="h-4 w-4 text-red-700" />, color: "text-red-700", label: "Failed" },
        cancelled: { icon: <Ban className="h-4 w-4 text-muted-foreground" />, color: "text-muted-foreground", label: "Cancelled" },
    };

    const currentStatus = STATUS_MAP[status] || { icon: <HelpCircle className="h-4 w-4" />, color: "", label: status };

    return (
        <div className={cn("flex items-center gap-1.5", currentStatus.color)}>
            {currentStatus.icon}
            <span className="capitalize font-medium">{currentStatus.label}</span>
        </div>
    );
};

function ScheduleItemDetails({ item }: { item: ScheduleListItem }) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div className="p-3 bg-muted/30 border-t">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs">
                <div className="space-y-2">
                    <h5 className="font-semibold text-xs uppercase text-muted-foreground">Details</h5>
                    {item.last_error && (
                        <div className="p-2 bg-red-500/10 text-red-700 rounded-md">
                            <p className="font-bold flex items-center gap-2"><AlertCircle className="h-4 w-4" />Last Error</p>
                            <p className="font-mono text-xs mt-1">{item.last_error}</p>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Attempts:</span>
                        <span className="font-mono">{item.attempts || 0} / {item.max_attempts ?? '∞'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Idempotency Key:</span>
                        {item.idempotency_key ? (
                            <div className="flex items-center gap-1">
                                <span className="font-mono text-gray-500 truncate max-w-[120px]">{item.idempotency_key}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.idempotency_key!)}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : <span className="text-muted-foreground">N/A</span>}
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-mono">{item.created_at ? format(parseUtcDate(item.created_at)!, 'Pp') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Updated:</span>
                        <span className="font-mono">{item.updated_at ? format(parseUtcDate(item.updated_at)!, 'Pp') : 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div className="mt-3">
                {item.dag_spec && <JsonViewer data={item.dag_spec} title="DAG Spec" />}
                {item.payload && <JsonViewer data={item.payload} title="Payload" />}
                {item.context && <JsonViewer data={item.context} title="Context" />}
            </div>
        </div>
    );
}


function ScheduleItem({ item, onSelect, isSelected }: { item: ScheduleListItem, onSelect: (id: number) => void, isSelected: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dueDate = parseUtcDate(item.due_at);
  const isOverdue = dueDate && isPast(dueDate) && item.status === 'pending';

  const queryClient = useQueryClient();
  const { mutate: cancelSchedule, isPending: isCancelling } = useActionScheduleCancelSchedulesApiOrchestratorActionsSchedulesCancelPost({
    mutation: {
      onSuccess: (_, variables) => {
        toast.success(`Schedule #${variables.data.schedule_ids?.join(', ')} cancelled.`);
        queryClient.invalidateQueries({ queryKey: ['BffScheduleListSchedulesApiBffSchedulesGet'] });
      },
      onError: (error: any) => {
        toast.error("Failed to cancel schedule.", { description: error.detail?.[0]?.msg || error.message });
      },
    },
  });

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelSchedule({ data: { schedule_ids: [item.id] } });
  };

  const dateColor = cn("text-muted-foreground", {
    "text-red-600 font-bold": isOverdue,
    "text-blue-600 font-medium": !isOverdue && dueDate && isToday(dueDate),
    "text-purple-500 font-medium": !isOverdue && dueDate && isTomorrow(dueDate),
  });

  return (
    <div 
        className="rounded-lg border bg-card text-card-foreground transition-all duration-200"
        data-is-selected={isSelected}
    >
        <div 
            className="flex items-start gap-3 p-2.5 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="pt-1 flex items-center gap-3">
                <Checkbox checked={isSelected} onCheckedChange={(checked) => onSelect(item.id)} onClick={(e) => e.stopPropagation()} />
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
            </div>
            <div className="flex-1 grid gap-1">
                <p className="font-medium text-sm leading-tight">{item.meta?.label || `Schedule #${item.id}`}</p>
                
                <div className={`flex items-center gap-2 text-xs ${dateColor}`}>
                    {dueDate ? (
                        <>
                            <CalendarDays className="h-3.5 w-3.5" />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="font-mono">{format(dueDate, "MMM d, h:mm a")}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{formatDistanceToNow(dueDate, { addSuffix: true })}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground">No due date</span>
                    )}
                </div>

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                    <StatusDisplay status={item.status as ScheduleStatus} dueDate={dueDate} />
                    <div className="flex items-center gap-1.5">
                        <UserCircle className="h-3.5 w-3.5" />
                        <span>ID: {item.persona_account_id}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs px-1.5 py-0.5">{item.queue || 'default'}</Badge>
                    {['enqueued', 'running'].includes(item.status) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-1"
                                        onClick={handleCancel}
                                        disabled={isCancelling}
                                    >
                                        {isCancelling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Cancel Schedule</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
        </div>
        {isExpanded && <ScheduleItemDetails item={item} />}
    </div>
  )
}

interface ScheduleListProps {
    items: ScheduleListItem[];
    selectedIds: number[];
    onSelect: (id: number) => void;
    isLoading: boolean;
}

const UpcomingList = ({ items, selectedIds, onSelect }: ScheduleListProps) => {
    const { groupedSchedules, groupOrder, otherSchedules } = useMemo(() => {
        const upcoming = items.filter(item => {
            const dueDate = parseUtcDate(item.due_at);
            return dueDate && isFuture(dueDate);
        });
        const other = items.filter(item => {
            const dueDate = parseUtcDate(item.due_at);
            return !dueDate || !isFuture(dueDate);
        });

        const grouped = upcoming
            .sort((a, b) => parseUtcDate(a.due_at!)!.getTime() - parseUtcDate(b.due_at!)!.getTime())
            .reduce((acc, item) => {
                const dueDate = parseUtcDate(item.due_at!)!;
                let group: "Today" | "Tomorrow" | "This Week" | "Upcoming" = "Upcoming";
                if (isToday(dueDate)) group = "Today";
                else if (isTomorrow(dueDate)) group = "Tomorrow";
                else if (isThisWeek(dueDate, { weekStartsOn: 1 })) group = "This Week";

                if (!acc[group]) acc[group] = [];
                acc[group].push(item);
                return acc;
            }, {} as Record<"Today" | "Tomorrow" | "This Week" | "Upcoming", ScheduleListItem[]>);
        
        return { 
            groupedSchedules: grouped,
            groupOrder: ["Today", "Tomorrow", "This Week", "Upcoming"],
            otherSchedules: other.sort((a, b) => {
                const dateA = parseUtcDate(a.due_at)?.getTime() || 0;
                const dateB = parseUtcDate(b.due_at)?.getTime() || 0;
                return dateB - dateA;
            })
        };
    }, [items]);

    return (
        <div className="space-y-4">
            {groupOrder.map(group => (
                groupedSchedules[group as keyof typeof groupedSchedules] && groupedSchedules[group as keyof typeof groupedSchedules].length > 0 && (
                    <div key={group}>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider mb-2 px-2">{group} <span className="font-mono">({groupedSchedules[group as keyof typeof groupedSchedules].length})</span></h4>
                        <div className="space-y-2">
                            {groupedSchedules[group as keyof typeof groupedSchedules].map(item => (
                                <ScheduleItem key={item.id} item={item} onSelect={onSelect} isSelected={selectedIds.includes(item.id)} />
                            ))}
                        </div>
                    </div>
                )
            ))}

            {otherSchedules.length > 0 && (
                <div className="pt-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider mb-2 px-2">Processed & Undated <span className="font-mono">({otherSchedules.length})</span></h4>
                    <div className="space-y-2 opacity-90 hover:opacity-100 transition-opacity">
                        {otherSchedules.map(item => (
                            <ScheduleItem key={item.id} item={item} onSelect={onSelect} isSelected={selectedIds.includes(item.id)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const OverdueList = ({ items, selectedIds, onSelect }: ScheduleListProps) => (
    <div className="space-y-2">
        {items.map(item => (
            <ScheduleItem key={item.id} item={item} onSelect={onSelect} isSelected={selectedIds.includes(item.id)} />
        ))}
    </div>
);

export function ScheduleList({ items, selectedIds, onSelect, isLoading }: ScheduleListProps) {
    const overdueSchedules = useMemo(() => items
      .filter(item => {
          const dueDate = parseUtcDate(item.due_at);
          return dueDate && isPast(dueDate) && item.status === 'pending';
      })
      .sort((a, b) => parseUtcDate(a.due_at!)!.getTime() - parseUtcDate(b.due_at!)!.getTime()), [items]);

    const upcomingSchedules = useMemo(() => items.filter(item => !overdueSchedules.some(o => o.id === item.id)), [items, overdueSchedules]);

    const InsightHeader = () => (
      <div className="px-4 pt-3 pb-2 border-b">
        <h3 className="font-semibold text-base">Schedule Overview</h3>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <span>Total: <span className="font-bold text-foreground">{items.length}</span></span>
          <span className="text-blue-600">Upcoming: <span className="font-bold">{upcomingSchedules.length}</span></span>
          {overdueSchedules.length > 0 && 
            <span className="text-red-600">Overdue: <span className="font-bold">{overdueSchedules.length}</span></span>
          }
        </div>
      </div>
    );

    const renderContent = () => {
        if (isLoading) return <p className="p-4 text-center text-muted-foreground">Loading schedules...</p>;
        if (items.length === 0) return <p className="p-4 text-center text-muted-foreground">No schedules found.</p>;

        const showTwoColumns = upcomingSchedules.length > 0 && overdueSchedules.length > 0;

        if (showTwoColumns) {
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 p-4">
                    <div>
                        <h3 className="text-base font-semibold px-2 mb-3 text-blue-500">Upcoming ({upcomingSchedules.length})</h3>
                        <ScrollArea className="h-[calc(100vh_-_250px)] -mx-2">
                            <div className="px-2">
                                <UpcomingList items={upcomingSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />
                            </div>
                        </ScrollArea>
                    </div>
                    <div>
                        <h3 className="text-base font-semibold px-2 mb-3 text-red-500">Overdue ({overdueSchedules.length})</h3>
                        <ScrollArea className="h-[calc(100vh_-_250px)] -mx-2">
                            <div className="px-2">
                                <OverdueList items={overdueSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            );
        }

        return (
            <ScrollArea className="h-[calc(100vh_-_220px)]">
                <div className="p-4">
                    {upcomingSchedules.length > 0 && <UpcomingList items={upcomingSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />}
                    {overdueSchedules.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-base font-semibold px-2 mb-3 text-red-600">Overdue ({overdueSchedules.length})</h3>
                            <OverdueList items={overdueSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />
                        </div>
                    )}
                </div>
            </ScrollArea>
        )
    }

    return (
        <div className="rounded-lg border bg-card text-card-foreground">
            <InsightHeader />
            {renderContent()}
        </div>
    )
}

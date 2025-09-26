import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScheduleListItem } from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, CalendarDays, UserCircle, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, isFuture, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const parseUtcDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    // Check if timezone is already specified (Z or +/- offset)
    if (dateString.endsWith('Z') || /[-+]\d{2}:\d{2}$/.test(dateString)) {
        return new Date(dateString);
    }
    // If not, append 'Z' to treat as UTC
    return new Date(dateString + 'Z');
};

function ScheduleItem({ item, onSelect, isSelected }: { item: ScheduleListItem, onSelect: (id: number) => void, isSelected: boolean }) {
  const dueDate = parseUtcDate(item.due_at);
  const isPending = item.status === 'pending';
  const isOverdue = dueDate && isPast(dueDate) && isPending;

  const statusIcon = isOverdue 
    ? <AlertTriangle className="h-4 w-4 text-red-500" />
    : isPending 
    ? <Clock className="h-4 w-4 text-amber-500" /> 
    : <CheckCircle2 className="h-4 w-4 text-green-500" />;

  const dateColor = cn("text-muted-foreground", {
    "text-red-600 font-bold": isOverdue,
    "text-blue-600 font-medium": !isOverdue && dueDate && isToday(dueDate),
    "text-purple-500 font-medium": !isOverdue && dueDate && isTomorrow(dueDate),
    "text-blue-400": !isOverdue && dueDate && !isToday(dueDate) && !isTomorrow(dueDate) && isThisWeek(dueDate, { weekStartsOn: 1 }),
  });

  return (
    <div 
        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer data-[is-selected=true]:bg-blue-500/10"
        onClick={() => onSelect(item.id)}
        data-is-selected={isSelected}
    >
      <div className="pt-1">
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(item.id)} />
      </div>
      <div className="flex-1 grid gap-1">
        <p className="font-medium text-sm leading-tight">{item.meta?.label || `Schedule #${item.id}`}</p>
        
        <div className={`flex items-center gap-2 text-xs ${dateColor}`}>
            {dueDate ? (
                <>
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="font-mono">{format(dueDate, "MMM d, h:mm a")}</span>
                    <span className="hidden md:inline-block italic">({formatDistanceToNow(dueDate, { addSuffix: true })})</span>
                </>
            ) : (
                <span className="text-xs text-muted-foreground">No due date</span>
            )}
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1.5">
                {statusIcon}
                <span className="capitalize">{item.status}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" />
                <span>ID: {item.persona_account_id}</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs px-1.5 py-0.5">{item.queue || 'default'}</Badge>
        </div>
      </div>
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
        <div className="space-y-3">
            {groupOrder.map(group => (
                groupedSchedules[group] && groupedSchedules[group].length > 0 && (
                    <div key={group}>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider mb-2 px-2">{group} <span className="font-mono">({groupedSchedules[group].length})</span></h4>
                        <div className="space-y-1">
                            {groupedSchedules[group].map(item => (
                                <ScheduleItem key={item.id} item={item} onSelect={onSelect} isSelected={selectedIds.includes(item.id)} />
                            ))}
                        </div>
                    </div>
                )
            ))}

            {otherSchedules.length > 0 && (
                    <div className="pt-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground/80 tracking-wider mb-2 px-2">Processed & Undated <span className="font-mono">({otherSchedules.length})</span></h4>
                    <div className="space-y-1 opacity-80 hover:opacity-100 transition-opacity">
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
    <div className="space-y-1">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 p-4">
                    <div>
                        <h3 className="text-base font-semibold px-2 mb-3 text-blue-400">Upcoming ({upcomingSchedules.length})</h3>
                        <ScrollArea className="h-[450px] -mx-2">
                            <div className="px-2">
                                <UpcomingList items={upcomingSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />
                            </div>
                        </ScrollArea>
                    </div>
                    <div>
                        <h3 className="text-base font-semibold px-2 mb-3 text-red-400">Overdue ({overdueSchedules.length})</h3>
                        <ScrollArea className="h-[450px] -mx-2">
                            <div className="px-2">
                                <OverdueList items={overdueSchedules} selectedIds={selectedIds} onSelect={onSelect} isLoading={false} />
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            );
        }

        return (
            <ScrollArea className="h-[480px]">
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
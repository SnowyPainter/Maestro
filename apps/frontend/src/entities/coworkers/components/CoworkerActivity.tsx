import { useMemo, useState, useCallback } from "react";
import { useQueries } from "@tanstack/react-query";
import {
    format,
    formatDistanceToNow,
    isPast,
    isToday,
    isFuture,
    startOfDay,
    addDays,
    subDays,
    eachDayOfInterval,
    isSameDay,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { 
    getBffScheduleListSchedulesApiBffSchedulesGetQueryOptions,
    ScheduleListItem,
    ScheduleStatus
} from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Ban, CircleDashed, RefreshCw, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { ScheduleMetaDetails } from "./ScheduleMetaDetails";

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

// GitHub activity 스타일의 날짜별 스케줄 빈도 표시
const ActivityDay = ({
    date,
    count,
    isToday,
    onClick
}: {
    date: Date;
    count: number;
    isToday: boolean;
    onClick: () => void;
}) => {

    const getIntensityColor = (count: number) => {
        if (count === 0) return 'bg-gray-200';
        if (count <= 2) return 'bg-green-300';
        if (count <= 5) return 'bg-green-400';
        if (count <= 10) return 'bg-green-500';
        return 'bg-green-600';
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        className={cn(
                            "w-full h-full rounded-sm border border-gray-300 transition-colors hover:ring-2 hover:ring-green-300 hover:ring-offset-1",
                            getIntensityColor(count),
                            isToday && "ring-2 ring-blue-400 ring-offset-1"
                        )}
                        onClick={onClick}
                        aria-label={`${format(date, 'MMM d, yyyy')}: ${count} schedules`}
                    />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">
                        <strong>{format(date, 'MMM d, yyyy')}</strong><br />
                        {count === 0 ? 'No schedules' : `${count} schedule${count === 1 ? '' : 's'}`}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// 날짜별 스케줄 목록 표시
const DayScheduleList = ({
    date,
    schedules,
    onScheduleClick
}: {
    date: Date;
    schedules: ScheduleListItem[];
    onScheduleClick: (schedule: ScheduleListItem) => void;
}) => (
    <div className="space-y-2">
        <ScrollArea className="h-80 pr-4">
            <div className="space-y-2">
                {schedules.map(schedule => (
                    <div
                        key={schedule.id}
                        className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onScheduleClick(schedule)}
                    >
                        <StatusDisplay status={schedule.status as ScheduleStatus} dueDate={parseUtcDate(schedule.due_at)} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {schedule.meta?.label || `Schedule #${schedule.id}`}
                            </p>
                            {schedule.status === 'failed' && schedule.last_error && (
                                <p className="text-xs text-red-600 truncate">
                                    Error: {schedule.last_error}
                                </p>
                            )}
                        </div>
                        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                ))}
            </div>
        </ScrollArea>
    </div>
);

// GitHub activity 스타일의 메인 컴포넌트
const ActivityGrid = ({
    schedules,
    onDayClick,
    onScheduleClick
}: {
    schedules: ScheduleListItem[];
    onDayClick: (date: Date) => void;
    onScheduleClick: (schedule: ScheduleListItem) => void;
}) => {
    const today = new Date();
    const WEEKS_PER_VIEW = 12; // 한 번에 12주씩 표시
    const WEEKS_TO_JUMP = 6; // 6주씩 점프

    // 오늘을 가운데로 하는 초기 offset 계산
    const initialOffset = useMemo(() => {
        const todayWeekIndex = Math.floor((today.getTime() - subDays(today, 180).getTime()) / (7 * 24 * 60 * 60 * 1000));
        return Math.max(0, Math.min(52 - WEEKS_PER_VIEW, todayWeekIndex - Math.floor(WEEKS_PER_VIEW / 2)));
    }, []);

    const [currentWeekOffset, setCurrentWeekOffset] = useState(initialOffset);

    // 오늘 기준 ±6개월로 전체 52주 그리드 생성
    const { weeks, schedulesByDate } = useMemo(() => {
        const map = new Map<string, ScheduleListItem[]>();

        schedules.forEach(schedule => {
            const dueDate = parseUtcDate(schedule.due_at);
            if (dueDate) {
                const dateKey = format(startOfDay(dueDate), 'yyyy-MM-dd');
                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                map.get(dateKey)!.push(schedule);
            }
        });

        // 전체 범위: 오늘 기준 ±6개월 (52주)
        const result = [];
        const startWeek = startOfWeek(subDays(today, 180), { weekStartsOn: 1 }); // 6개월 전부터

        for (let week = 0; week < 52; week++) {
            const weekStart = addDays(startWeek, week * 7);
            const weekDays = [];

            for (let day = 0; day < 7; day++) {
                const date = addDays(weekStart, day);
                const dateKey = format(date, 'yyyy-MM-dd');
                const daySchedules = map.get(dateKey) || [];
                const isToday = isSameDay(date, today);

                weekDays.push({
                    date,
                    count: daySchedules.length,
                    isToday,
                    schedules: daySchedules
                });
            }

            result.push(weekDays);
        }

        return {
            weeks: result,
            schedulesByDate: map
        };
    }, [schedules, today]);

    // 현재 표시할 주 범위
    const visibleWeeks = weeks.slice(currentWeekOffset, currentWeekOffset + WEEKS_PER_VIEW);

    const handlePrev = () => {
        setCurrentWeekOffset(Math.max(0, currentWeekOffset - WEEKS_TO_JUMP));
    };

    const handleNext = () => {
        setCurrentWeekOffset(Math.min(52 - WEEKS_PER_VIEW, currentWeekOffset + WEEKS_TO_JUMP));
    };

    const canGoPrev = currentWeekOffset > 0;
    const canGoNext = currentWeekOffset < 52 - WEEKS_PER_VIEW;

    return (
        <div className="space-y-4 w-full relative">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </button>

                <div className="text-sm text-muted-foreground">
                    {format(visibleWeeks[0]?.[0]?.date || today, 'MMM d')} - {format(visibleWeeks[visibleWeeks.length - 1]?.[6]?.date || today, 'MMM d, yyyy')}
                </div>

                <button
                    onClick={handleNext}
                    disabled={!canGoNext}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>


            {/* 요일 표시 + 그리드 */}
            <div className="flex gap-0.5">
                {/* 요일 표시 */}
                <div className="flex flex-col text-xs text-muted-foreground flex-shrink-0" style={{ width: '2.5rem' }}>
                    {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((day, index) => (
                        <div key={index} className="flex-1 flex items-center justify-center">
                            {day}
                        </div>
                    ))}
                </div>

                {/* 그리드 */}
                <div className="flex gap-0.5 flex-1">
                    {visibleWeeks.map((week, weekIndex) => (
                        <div key={`week-${currentWeekOffset + weekIndex}`} className="flex flex-col gap-0.5 flex-1">
                            {week.map((day, dayIndex) => (
                                <div key={`day-container-${currentWeekOffset + weekIndex}-${dayIndex}`} className="flex-1">
                                    <ActivityDay
                                        date={day.date}
                                        count={day.count}
                                        isToday={day.isToday}
                                        onClick={() => onDayClick(day.date)}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-1">
                    {[0, 1, 3, 6].map(count => (
                        <div
                            key={count}
                            className={cn(
                                "w-6 h-6 rounded-sm border-2 border-gray-300",
                                count === 0 ? 'bg-gray-200' :
                                count <= 2 ? 'bg-green-300' :
                                count <= 5 ? 'bg-green-400' : 'bg-green-500'
                            )}
                        />
                    ))}
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export const CoworkerActivity = ({ personaAccountIds }: { personaAccountIds: number[] }) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleListItem | null>(null);

    const scheduleQueries = useQueries({
        queries: (personaAccountIds || []).map(id => ({
            ...getBffScheduleListSchedulesApiBffSchedulesGetQueryOptions({ persona_account_id: id, limit: 200 }),
            refetchInterval: 30000, // 30초마다 자동으로 refetch
        })),
    });

    const isLoading = scheduleQueries.some(q => q.isLoading);
    const allSchedules = scheduleQueries.flatMap(q => q.data?.items || []);

    const handleDayClick = useCallback((date: Date) => {
        setSelectedDate(date);
        setSelectedSchedule(null);
    }, []);

    const handleScheduleClick = useCallback((schedule: ScheduleListItem) => {
        setSelectedSchedule(schedule);
    }, []);

    // 선택된 날짜의 스케줄들 필터링
    const selectedDateSchedules = useMemo(() => {
        if (!selectedDate) return [];

        return allSchedules.filter(schedule => {
            const dueDate = parseUtcDate(schedule.due_at);
            return dueDate && isSameDay(dueDate, selectedDate);
        });
    }, [selectedDate, allSchedules]);

    if (isLoading && personaAccountIds.length > 0) {
        return (
            <div className="py-2">
                <h4 className="text-sm font-semibold text-muted-foreground mb-4 px-4">Co-Worker Activity</h4>
                <div className="px-4">
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    if (allSchedules.length === 0) {
        return (
            <div className="py-2">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 px-4">Co-Worker Activity</h4>
                <p className="text-xs text-muted-foreground text-center py-4">No activity found for monitored accounts.</p>
            </div>
        );
    }

    return (
        <div className="py-2">
            <h4 className="text-sm font-semibold text-muted-foreground mb-4 px-4">Co-Worker Activity</h4>

            <div className="px-4">
                <ActivityGrid
                    schedules={allSchedules}
                    onDayClick={handleDayClick}
                    onScheduleClick={handleScheduleClick}
                />
            </div>

            {/* 날짜별 스케줄 목록 다이얼로그 */}
            <Dialog open={!!selectedDate && !selectedSchedule} onOpenChange={(isOpen) => !isOpen && setSelectedDate(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            {selectedDate && format(selectedDate, 'MMM d, yyyy')}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDateSchedules.length} schedule{selectedDateSchedules.length === 1 ? '' : 's'} on this date
                        </DialogDescription>
                    </DialogHeader>
                    {selectedDate && (
                        <DayScheduleList
                            date={selectedDate}
                            schedules={selectedDateSchedules}
                            onScheduleClick={handleScheduleClick}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* 스케줄 상세 다이얼로그 */}
            <Dialog open={!!selectedSchedule} onOpenChange={(isOpen) => !isOpen && setSelectedSchedule(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Schedule Details</DialogTitle>
                        <DialogDescription>
                            Detailed information for schedule #{selectedSchedule?.id}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedSchedule && (
                        <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
                           <ScheduleMetaDetails meta={selectedSchedule.meta} schedule={selectedSchedule} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
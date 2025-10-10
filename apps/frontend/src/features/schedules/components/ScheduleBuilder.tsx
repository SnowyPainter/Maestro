import { useState } from "react";
import { MailBatchRequest, PostPublishBatchRequest, SyncMetricsBatchRequest } from "@/lib/api/generated";
import { ScheduleModeToggle } from "./ScheduleBuilder/ModeToggle";
import { ImmediateRunConfirmation } from "./ScheduleBuilder/ImmediateRunConfirmation";
import { ScheduledRunSettings } from "./ScheduleBuilder/ScheduledRunSettings";

// A generic type that includes the common batch scheduling fields.
type BatchRequest = MailBatchRequest | PostPublishBatchRequest | SyncMetricsBatchRequest;

export interface ScheduleBuilderProps<T extends BatchRequest> {
    value: Partial<T>;
    onChange: (data: Partial<T>) => void;
    errors?: any;
}

export function toYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function ScheduleBuilder<T extends BatchRequest>({ value, onChange, errors }: ScheduleBuilderProps<T>) {
    const [mode, setMode] = useState<'now' | 'later'>('later');

    const handleScheduleNow = () => {
        const now = new Date();
        const end = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins from now
        const formatTime = (d: Date) => d.toTimeString().split(' ')[0];

        onChange({
            ...value,
            date_range: { start: toYYYYMMDD(now), end: toYYYYMMDD(end) },
            weekmask: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            segments: [{ id: 'now', start: formatTime(now), end: formatTime(end), count_per_day: 1 }]
        } as Partial<T>);
    };

    const handleModeChange = (newMode: 'now' | 'later') => {
        setMode(newMode);
        if (newMode === 'now') {
            handleScheduleNow();
        }
    };

    return (
        <div className="grid gap-4">
            <ScheduleModeToggle mode={mode} onModeChange={handleModeChange} />
            {mode === 'now' && <ImmediateRunConfirmation />}
            {mode === 'later' && <ScheduledRunSettings value={value} onChange={onChange} errors={errors} />}
        </div>
    );
}

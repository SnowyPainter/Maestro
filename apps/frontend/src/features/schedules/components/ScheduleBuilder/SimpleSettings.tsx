
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MailBatchRequest, SyncMetricsBatchRequest } from "@/lib/api/generated";
import { ScheduleBuilderProps } from "../ScheduleBuilder";

type BatchRequest = MailBatchRequest | SyncMetricsBatchRequest;

interface SimpleSettingsProps<T extends BatchRequest> extends ScheduleBuilderProps<T> {
    handleFieldChange: (path: string, val: any) => void;
}

export function SimpleSettings<T extends BatchRequest>({ value, onChange, errors, handleFieldChange }: SimpleSettingsProps<T>) {

    const handleFrequencyChange = (val: number[]) => {
        const count = val[0];
        const newSegments = count > 0 ? [{ id: "simple-default", start: "09:00:00", end: "17:00:00", count_per_day: count }] : [];
        handleFieldChange('segments', newSegments);
    };

    return (
        <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={value.date_range?.start || ''} onChange={e => handleFieldChange('date_range.start', e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={value.date_range?.end || ''} onChange={e => handleFieldChange('date_range.end', e.target.value)} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label>Frequency</Label>
                <Slider 
                    defaultValue={[value.segments?.[0]?.count_per_day || 1]} 
                    min={1} 
                    max={10} 
                    step={1} 
                    onValueChange={handleFrequencyChange} 
                />
                <p className="text-sm text-muted-foreground">Approximate items per day (during business hours).</p>
            </div>
        </div>
    );
}


import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MailBatchRequest, ScheduleSegment, SyncMetricsBatchRequest } from "@/lib/api/generated";
import { ScheduleBuilderProps } from "../ScheduleBuilder";
import { TimeSegmentEditor } from "./TimeSegmentsBar";

type BatchRequest = MailBatchRequest | SyncMetricsBatchRequest;

interface AdvancedSettingsProps<T extends BatchRequest> extends ScheduleBuilderProps<T> {
    handleFieldChange: (path: string, val: any) => void;
}

export function AdvancedSettings<T extends BatchRequest>({ value, onChange, errors, handleFieldChange }: AdvancedSettingsProps<T>) {

    const handleSegmentsChange = (segments: ScheduleSegment[]) => {
        handleFieldChange('segments', segments as T['segments']);
    };

    return (
        <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={value.date_range?.start || ''} onChange={e => handleFieldChange('date_range.start', e.target.value)} />
                    <p className="text-sm text-destructive">{errors?.date_range?.[0]}</p>
                </div>
                <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={value.date_range?.end || ''} onChange={e => handleFieldChange('date_range.end', e.target.value)} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label>Send on Days</Label>
                <ToggleGroup type="multiple" variant="outline" value={value.weekmask} onValueChange={v => handleFieldChange('weekmask', v)} className="flex-wrap justify-start">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>)}
                </ToggleGroup>
            </div>
            <TimeSegmentEditor
                value={(value.segments || []) as ScheduleSegment[]}
                onChange={handleSegmentsChange}
                error={typeof errors?.segments === 'string' ? errors.segments : undefined}
            />
        </div>
    );
}

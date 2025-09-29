import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlusCircle, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { MailBatchRequest, PostPublishBatchRequest, SyncMetricsBatchRequest } from "@/lib/api/generated";

// A generic type that includes the common batch scheduling fields.
type BatchRequest = MailBatchRequest | PostPublishBatchRequest | SyncMetricsBatchRequest;

interface BatchScheduleFormPartProps<T extends BatchRequest> {
    value: Partial<T>;
    onChange: (data: Partial<T>) => void;
    errors?: any;
}

function toYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function BatchScheduleFormPart<T extends BatchRequest>({ value, onChange, errors }: BatchScheduleFormPartProps<T>) {
    const [scheduleType, setScheduleType] = useState("later");

    const handleFieldChange = (path: string, val: any) => {
        const keys = path.split('.');
        const new_data = JSON.parse(JSON.stringify(value || {}));
        let current: any = new_data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = val;
        onChange(new_data);
    };

    const handleFrequencyChange = (val: number[]) => {
        const count = val[0];
        const newSegments = count > 0 ? [{ id: "simple-default", start: "09:00:00", end: "17:00:00", count_per_day: count }] : [];
        handleFieldChange('segments', newSegments);
    };

    const handleAddSegment = () => {
        const newSegments = [...(value.segments || []), { id: `segment-${Date.now()}`, start: "09:00:00", end: "17:00:00", count_per_day: 1 }] as T['segments'];
        handleFieldChange('segments', newSegments);
    };

    const handleRemoveSegment = (index: number) => {
        const newSegments = value.segments?.filter((_, i) => i !== index);
        handleFieldChange('segments', newSegments);
    };

    const setScheduleRightNow = () => {
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

    return (
        <div className="grid gap-4">
            <Tabs value={scheduleType} onValueChange={(v) => {
                setScheduleType(v);
                if (v === 'now') {
                    setScheduleRightNow();
                }
            }}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="later">Schedule for Later</TabsTrigger>
                    <TabsTrigger value="now">Run Once, Right Now</TabsTrigger>
                </TabsList>
                <TabsContent value="now" className="p-4 text-center text-muted-foreground">
                    This will be executed once, starting immediately.
                </TabsContent>
                <TabsContent value="later">
                    <Tabs defaultValue="simple">
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="simple">Simple</TabsTrigger><TabsTrigger value="advanced">Advanced</TabsTrigger></TabsList>
                        <TabsContent value="simple" className="p-6 pt-4">
                            <div className="grid gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={value.date_range?.start || ''} onChange={e => handleFieldChange('date_range.start', e.target.value)} /></div>
                                    <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={value.date_range?.end || ''} onChange={e => handleFieldChange('date_range.end', e.target.value)} /></div>
                                </div>
                                <div className="grid gap-2"><Label>Frequency</Label><Slider defaultValue={[value.segments?.[0]?.count_per_day || 1]} min={1} max={10} step={1} onValueChange={handleFrequencyChange} /><p className="text-sm text-muted-foreground">Approximate items per day.</p></div>
                            </div>
                        </TabsContent>
                        <TabsContent value="advanced" className="p-6 pt-4">
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={value.date_range?.start || ''} onChange={e => handleFieldChange('date_range.start', e.target.value)} /><p className="text-sm text-destructive">{errors?.date_range?.[0]}</p></div>
                                    <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={value.date_range?.end || ''} onChange={e => handleFieldChange('date_range.end', e.target.value)} /></div>
                                </div>
                                <div className="grid gap-2"><Label>Send on Days</Label><ToggleGroup type="multiple" variant="outline" value={value.weekmask} onValueChange={v => handleFieldChange('weekmask', v)} className="flex-wrap justify-start">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>)}</ToggleGroup></div>
                                <div className="grid gap-2"><Label>Time Segments</Label>
                                    {value.segments?.map((item, index) => (
                                        <div key={index} className="flex items-end gap-2 p-2 border rounded-lg">
                                            <div className="grid gap-1.5 flex-1"><Label>Start</Label><Input type="time" step="1" value={item.start} onChange={e => handleFieldChange(`segments.${index}.start`, e.target.value)} /></div>
                                            <div className="grid gap-1.5 flex-1"><Label>End</Label><Input type="time" step="1" value={item.end} onChange={e => handleFieldChange(`segments.${index}.end`, e.target.value)} /></div>
                                            <div className="grid gap-1.5 w-20"><Label>Count</Label><Input type="number" value={item.count_per_day} onChange={e => handleFieldChange(`segments.${index}.count_per_day`, parseInt(e.target.value, 10))} /></div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSegment(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddSegment}><PlusCircle className="h-4 w-4 mr-2" />Add Segment</Button>
                                    <p className="text-sm text-destructive">{typeof errors?.segments === 'string' ? errors.segments : ''}</p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    );
}

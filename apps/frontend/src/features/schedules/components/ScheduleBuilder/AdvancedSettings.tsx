
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MailBatchRequest, PostPublishBatchRequest, SyncMetricsBatchRequest } from "@/lib/api/generated";
import { PlusCircle, Trash2 } from "lucide-react";
import { ScheduleBuilderProps } from "../ScheduleBuilder";

type BatchRequest = MailBatchRequest | PostPublishBatchRequest | SyncMetricsBatchRequest;

interface AdvancedSettingsProps<T extends BatchRequest> extends ScheduleBuilderProps<T> {
    handleFieldChange: (path: string, val: any) => void;
}

export function AdvancedSettings<T extends BatchRequest>({ value, onChange, errors, handleFieldChange }: AdvancedSettingsProps<T>) {

    const handleAddSegment = () => {
        const newSegments = [...(value.segments || []), { id: `segment-${Date.now()}`, start: "09:00:00", end: "17:00:00", count_per_day: 1 }] as T['segments'];
        handleFieldChange('segments', newSegments);
    };

    const handleRemoveSegment = (index: number) => {
        const newSegments = value.segments?.filter((_, i) => i !== index);
        handleFieldChange('segments', newSegments);
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
            <div className="grid gap-2">
                <Label>Time Segments</Label>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Start Time</TableHead>
                                <TableHead>End Time</TableHead>
                                <TableHead className="w-24">Count</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {value.segments?.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell><Input type="time" step="1" value={item.start} onChange={e => handleFieldChange(`segments.${index}.start`, e.target.value)} className="w-full" /></TableCell>
                                    <TableCell><Input type="time" step="1" value={item.end} onChange={e => handleFieldChange(`segments.${index}.end`, e.target.value)} className="w-full" /></TableCell>
                                    <TableCell><Input type="number" value={item.count_per_day} onChange={e => handleFieldChange(`segments.${index}.count_per_day`, parseInt(e.target.value, 10))} className="w-full" /></TableCell>
                                    <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSegment(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSegment} className="mt-2 w-max"><PlusCircle className="h-4 w-4 mr-2" />Add Segment</Button>
                <p className="text-sm text-destructive">{typeof errors?.segments === 'string' ? errors.segments : ''}</p>
            </div>
        </div>
    );
}

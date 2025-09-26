import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useActionScheduleCreateTrendsMailScheduleApiOrchestratorActionsSchedulesMailCreatePost, useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet, MailScheduleBatchRequest, MailScheduleSegment } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { PlusCircle, Trash2, AlertTriangle, Info } from "lucide-react";
import { z } from "zod";

function toYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function ContextPersonaDisplay() {
    const { personaAccountId } = usePersonaContextStore();
    const { data: allAccounts } = useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet();
    const account = allAccounts?.find(acc => acc.id === personaAccountId);
    if (!account) return <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-destructive"><AlertTriangle className="h-6 w-6" /><div><p className="font-semibold">No Active Persona</p><p className="text-xs">Please select a persona account first.</p></div></div>;
    return <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40"><Avatar className="h-9 w-9"><AvatarImage src={account.persona_avatar_url || undefined} /><AvatarFallback>{account.persona_name?.charAt(0)}</AvatarFallback></Avatar><div><p className="font-semibold">{account.persona_name}</p><p className="text-sm text-muted-foreground">{account.account_handle}</p></div></div>;
}

function ScheduleSummary({ data }: { data: Partial<MailScheduleBatchRequest> }) {
    const summary = useMemo(() => {
        const { date_range, weekmask, segments } = data;
        if (!date_range?.start || !date_range?.end) return "Please set a start and end date.";
        const avgCount = segments && segments.length > 0 ? Math.round(segments.reduce((acc, s) => acc + (s.count_per_day || 1), 0) / segments.length) : 0;
        const days = weekmask?.join(', ') || 'selected days';
        return `Sends ~${avgCount} email(s) per day on ${days}, from ${date_range.start} to ${date_range.end}.`;
    }, [data]);
    return <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Info className="h-4 w-4" /><span>{summary}</span></div>;
}

export function CreateBatchTrendsMailScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const { personaId, personaAccountId } = usePersonaContextStore();
    const [isReady, setIsReady] = useState(false);
    const [formData, setFormData] = useState<Partial<MailScheduleBatchRequest>>({});
    const [errors, setErrors] = useState<any>({});

    const createSchedule = useActionScheduleCreateTrendsMailScheduleApiOrchestratorActionsSchedulesMailCreatePost();

    useEffect(() => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + 1);

        const initial: Partial<MailScheduleBatchRequest> = {
            title: "",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            date_range: { start: toYYYYMMDD(startDate), end: toYYYYMMDD(endDate) },
            weekmask: ["MON", "TUE", "WED", "THU", "FRI"],
            segments: [{ id: `default`, start: "09:00:00", end: "17:00:00", count_per_day: 2 }],
            payload_template: { country: "US", limit: 20, email_to: "" } as any,
        };

        if (personaId && personaAccountId) {
            initial.payload_template!.persona_id = personaId;
            initial.payload_template!.persona_account_id = personaAccountId;
            setIsReady(true);
        } else {
            setIsReady(false);
        }
        setFormData(initial);
    }, [personaId, personaAccountId]);

    const handleFormChange = (path: string, value: any) => {
        setFormData(prev => {
            const keys = path.split('.');
            const new_data = JSON.parse(JSON.stringify(prev));
            let current: any = new_data;
            for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
            current[keys[keys.length - 1]] = value;
            return new_data;
        });
    };

    const handleFrequencyChange = (value: number[]) => {
        const count = value[0];
        const newSegments = count > 0 ? [{ id: "simple-default", start: "09:00:00", end: "17:00:00", count_per_day: count }] : [];
        handleFormChange('segments', newSegments);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors({});
        try {
            const result = await createSchedule.mutateAsync({ data: formData as MailScheduleBatchRequest });
            toast.success("Batch mail schedule created successfully.");
            onCreated(result.schedule_ids);
        } catch (error: any) {
            toast.error("Failed to create schedule.", { description: error.detail?.[0]?.msg || error.message });
        }
    }

    const isEmailValid = formData.payload_template?.email_to && formData.payload_template.email_to.includes('@');

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-2xl">
            <CardHeader><CardTitle>New Batch Trends Mail Schedule</CardTitle><CardDescription>Configure a recurring email schedule based on trend analysis.</CardDescription></CardHeader>
            <form onSubmit={handleSubmit}>
                <Tabs defaultValue="simple">
                    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="simple">Simple</TabsTrigger><TabsTrigger value="advanced">Advanced</TabsTrigger></TabsList>
                    <TabsContent value="simple" className="p-6 pt-4">
                        <div className="grid gap-6">
                            <div className="grid gap-2"><Label>Persona Account</Label><ContextPersonaDisplay /></div>
                            <div className="grid gap-2"><Label htmlFor="email_to">Recipient Email</Label><Input id="email_to" placeholder="recipient@example.com" value={formData.payload_template?.email_to || ''} onChange={e => handleFormChange('payload_template.email_to', e.target.value)} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={formData.date_range?.start || ''} onChange={e => handleFormChange('date_range.start', e.target.value)} /></div>
                                <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={formData.date_range?.end || ''} onChange={e => handleFormChange('date_range.end', e.target.value)} /></div>
                            </div>
                            <div className="grid gap-2"><Label>Frequency</Label><Slider defaultValue={[formData.segments?.[0]?.count_per_day || 1]} min={1} max={5} step={1} onValueChange={handleFrequencyChange} /><p className="text-sm text-muted-foreground">Approximate emails per day.</p></div>
                        </div>
                    </TabsContent>
                    <TabsContent value="advanced" className="p-6 pt-4">
                        <Accordion type="multiple" defaultValue={["item-1"]} className="w-full">
                            <AccordionItem value="item-1"><AccordionTrigger>1. Basic Info & Recipient</AccordionTrigger>
                                <AccordionContent className="pt-4 grid gap-4">
                                    <div className="grid gap-2"><Label>Persona Account</Label><ContextPersonaDisplay /></div>
                                    <div className="grid gap-2"><Label>Recipient Email</Label><Input type="email" placeholder="recipient@example.com" value={formData.payload_template?.email_to || ''} onChange={e => handleFormChange('payload_template.email_to', e.target.value)} /><p className="text-sm text-destructive">{errors.payload_template?.email_to?.[0]}</p></div>
                                    <div className="grid gap-2"><Label>Schedule Title</Label><Input placeholder="e.g., Weekly US Trends Digest" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} /><p className="text-sm text-destructive">{errors.title?.[0]}</p></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2"><AccordionTrigger>2. Scheduling Rules</AccordionTrigger>
                                <AccordionContent className="pt-4 grid gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={formData.date_range?.start || ''} onChange={e => handleFormChange('date_range.start', e.target.value)} /><p className="text-sm text-destructive">{errors.date_range?.[0]}</p></div>
                                        <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={formData.date_range?.end || ''} onChange={e => handleFormChange('date_range.end', e.target.value)} /></div>
                                    </div>
                                    <div className="grid gap-2"><Label>Send on Days</Label><ToggleGroup type="multiple" variant="outline" value={formData.weekmask} onValueChange={v => handleFormChange('weekmask', v)} className="flex-wrap justify-start">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>)}</ToggleGroup></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3"><AccordionTrigger>3. Time Segments</AccordionTrigger>
                                <AccordionContent className="pt-4 grid gap-4">
                                    {formData.segments?.map((item, index) => (
                                        <div key={index} className="flex items-end gap-2 p-2 border rounded-lg">
                                            <div className="grid gap-1.5 flex-1"><Label>Start</Label><Input type="time" step="1" value={item.start} onChange={e => handleFormChange(`segments.${index}.start`, e.target.value)} /></div>
                                            <div className="grid gap-1.5 flex-1"><Label>End</Label><Input type="time" step="1" value={item.end} onChange={e => handleFormChange(`segments.${index}.end`, e.target.value)} /></div>
                                            <div className="grid gap-1.5 w-20"><Label>Count</Label><Input type="number" value={item.count_per_day} onChange={e => handleFormChange(`segments.${index}.count_per_day`, parseInt(e.target.value, 10))} /></div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleFormChange('segments', formData.segments?.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleFormChange('segments', [...(formData.segments || []), { id: `segment-${Date.now()}`, start: "09:00:00", end: "17:00:00", count_per_day: 1 }])}><PlusCircle className="h-4 w-4 mr-2" />Add Segment</Button>
                                    <p className="text-sm text-destructive">{typeof errors.segments === 'string' ? errors.segments : ''}</p>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>
                </Tabs>
                <CardFooter className="px-6 py-4 border-t flex flex-col items-start gap-3">
                    <ScheduleSummary data={formData} />
                    <div className="w-full flex justify-end">
                        <Button type="submit" disabled={createSchedule.isPending || !isReady || !isEmailValid}>{createSchedule.isPending ? "Creating..." : "Create Schedule"}</Button>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}
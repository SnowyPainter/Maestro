import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    useActionScheduleCreateTrendsMailScheduleApiOrchestratorActionsSchedulesMailCreatePost, 
    useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet, 
    MailBatchRequest, 
    MailScheduleTemplateParams
} from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
import { BatchScheduleFormPart } from "./BatchScheduleFormPart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function ScheduleSummary({ data }: { data: Partial<MailBatchRequest> }) {
    const summary = useMemo(() => {
        const { date_range, weekmask, segments } = data;
        if (!date_range?.start || !date_range?.end) return "Please set a start and end date.";
        const avgCount = segments && segments.length > 0 ? Math.round(segments.reduce((acc, s) => acc + (s.count_per_day || 1), 0) / segments.length) : 0;
        const days = weekmask?.join(', ') || 'selected days';
        return `Sends ~${avgCount} email(s) per day on ${days}, from ${date_range.start} to ${date_range.end}.`;
    }, [data]);
    return <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Info className="h-4 w-4" /><span>{summary}</span></div>;
}

export function CreateTrendsMailScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const { personaId, personaAccountId } = usePersonaContextStore();
    const [isReady, setIsReady] = useState(false);
    const [formData, setFormData] = useState<Partial<MailBatchRequest>>({});
    const [errors, setErrors] = useState<any>({});

    const createSchedule = useActionScheduleCreateTrendsMailScheduleApiOrchestratorActionsSchedulesMailCreatePost();

    useEffect(() => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + 1);

        const initialPayload: Partial<MailScheduleTemplateParams> = {
            country: "US",
            limit: 20,
            email_to: ""
        };

        if (personaId && personaAccountId) {
            initialPayload.persona_id = personaId;
            initialPayload.persona_account_id = personaAccountId;
            setIsReady(true);
        } else {
            setIsReady(false);
        }

        const initial: Partial<MailBatchRequest> = {
            title: "",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            date_range: { start: toYYYYMMDD(startDate), end: toYYYYMMDD(endDate) },
            weekmask: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            segments: [{ id: `default`, start: "09:00:00", end: "17:00:00", count_per_day: 1 }],
            payload_template: initialPayload as MailScheduleTemplateParams,
        };
        
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
    
    const handleBatchDataChange = (batchData: Partial<Pick<MailBatchRequest, 'date_range' | 'weekmask' | 'segments'>>) => {
        setFormData(prev => ({ ...prev, ...batchData }));
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors({});
        try {
            const result = await createSchedule.mutateAsync({ data: formData as MailBatchRequest });
            toast.success("Batch mail schedule created successfully.");
            onCreated(result.schedule_ids);
        } catch (error: any) {
            toast.error("Failed to create schedule.", { description: error.detail?.[0]?.msg || error.message });
        }
    }

    const isEmailValid = formData.payload_template?.email_to && formData.payload_template.email_to.includes('@');
    
    const batchData = {
        date_range: formData.date_range,
        weekmask: formData.weekmask,
        segments: formData.segments,
    };

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-2xl">
            <CardHeader><CardTitle>New Trends Mail Schedule</CardTitle><CardDescription>Configure a recurring email schedule based on trend analysis.</CardDescription></CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="p-6">
                    <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="w-full">
                        <AccordionItem value="item-1"><AccordionTrigger>1. Target Persona</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <ContextPersonaDisplay />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2"><AccordionTrigger>2. Mail Content & Recipient</AccordionTrigger>
                            <AccordionContent className="pt-4 grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Schedule Title</Label>
                                    <Input placeholder="e.g., Weekly US Trends Digest" value={formData.title || ''} onChange={e => handleFormChange('title', e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Recipient Email</Label>
                                    <Input type="email" placeholder="recipient@example.com" value={formData.payload_template?.email_to || ''} onChange={e => handleFormChange('payload_template.email_to', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Country</Label>
                                        <Select value={formData.payload_template?.country || 'US'} onValueChange={v => handleFormChange('payload_template.country', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="US">United States</SelectItem>
                                                <SelectItem value="KR">South Korea</SelectItem>
                                                <SelectItem value="JP">Japan</SelectItem>
                                                <SelectItem value="GB">United Kingdom</SelectItem>
                                                <SelectItem value="DE">Germany</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Limit</Label>
                                        <Input type="number" value={formData.payload_template?.limit || 20} onChange={e => handleFormChange('payload_template.limit', parseInt(e.target.value, 10))} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3"><AccordionTrigger>3. Scheduling</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <BatchScheduleFormPart<MailBatchRequest> value={batchData} onChange={handleBatchDataChange} errors={errors} />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
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
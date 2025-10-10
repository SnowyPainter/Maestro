import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    useActionScheduleCreateTrendsMailScheduleApiOrchestratorActionsSchedulesMailCreatePost, 
    useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet, 
    MailBatchRequest, 
    MailScheduleTemplateParams,
    ScheduleTemplateKey
} from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { AlertTriangle, Info, User, Mail, Calendar } from "lucide-react";
import { ScheduleBuilder } from "./ScheduleBuilder";
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
    const [currentStep, setCurrentStep] = useState(2); // Start from step 2 since step 1 is auto-selected
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
            template: ScheduleTemplateKey.mailtrends_with_reply,
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

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 2) { // Start from step 2
            setCurrentStep(prev => prev - 1);
        }
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
    const isStep1Valid = personaAccountId;
    const isStep2Valid = formData.title && isEmailValid;
    const isStep3Valid = formData.date_range && formData.weekmask && formData.segments;

    const progressValue = ((currentStep - 1) / 2) * 100; // Adjusted for 2 steps instead of 3

    const batchData = {
        date_range: formData.date_range,
        weekmask: formData.weekmask,
        segments: formData.segments,
        template: formData.template,
    };

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-4xl mx-auto">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">Schedule Trends Mail</CardTitle>
                        <CardDescription className="text-base mt-1">
                            Set up automated trend analysis emails
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm">
                        Step {currentStep - 1} of 2
                    </Badge>
                </div>
                <Progress value={progressValue} className="mt-4" />
            </CardHeader>
            <CardContent className="p-6">
                {/* Auto-selected Persona Info */}
                <div className="mb-6 p-4 bg-muted/20 rounded-lg border">
                    <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-primary" />
                        <Label className="text-sm font-medium">Active Persona</Label>
                    </div>
                    <ContextPersonaDisplay />
                </div>

                {currentStep === 2 && (
                    /* Step 1: Mail Configuration */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <Mail className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Configure Mail</Label>
                        </div>

                        <div className="grid gap-6 max-w-2xl">
                            <div className="grid gap-2">
                                <Label className="text-sm font-medium">Schedule Title</Label>
                                <Input
                                    placeholder="e.g., Weekly US Trends Digest"
                                    value={formData.title || ''}
                                    onChange={e => handleFormChange('title', e.target.value)}
                                    className="text-base"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-sm font-medium">Recipient Email</Label>
                                <Input
                                    type="email"
                                    placeholder="recipient@example.com"
                                    value={formData.payload_template?.email_to || ''}
                                    onChange={e => handleFormChange('payload_template.email_to', e.target.value)}
                                    className="text-base"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">Country</Label>
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
                                    <Label className="text-sm font-medium">Trend Limit</Label>
                                    <Input
                                        type="number"
                                        value={formData.payload_template?.limit || 20}
                                        onChange={e => handleFormChange('payload_template.limit', parseInt(e.target.value, 10))}
                                        className="text-base"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    /* Step 2: Scheduling */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Schedule Settings</Label>
                        </div>

                        <div className="max-w-2xl">
                            <ScheduleBuilder<MailBatchRequest> value={batchData} onChange={handleBatchDataChange} errors={errors} />
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-6 border-t bg-muted/20 flex justify-between">
                <div className="flex gap-2">
                    {currentStep > 1 && (
                        <Button
                            variant="outline"
                            onClick={handlePrev}
                            disabled={createSchedule.isPending}
                        >
                            Previous
                        </Button>
                    )}
                </div>

                <div className="flex gap-2">
                    {currentStep < 3 && (
                        <Button
                            onClick={handleNext}
                            disabled={createSchedule.isPending ||
                                (currentStep === 2 && !isStep2Valid)
                            }
                        >
                            Next
                        </Button>
                    )}

                    {currentStep === 3 && (
                        <Button
                            onClick={(e) => {
                                e.preventDefault();
                                handleSubmit(e as any);
                            }}
                            disabled={createSchedule.isPending || !isStep3Valid || !isReady || !isEmailValid}
                            className="min-w-32"
                        >
                            {createSchedule.isPending ? "Creating..." : "Create Schedule"}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
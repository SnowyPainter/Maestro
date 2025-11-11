import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet,
    SyncMetricsBatchRequest,
    SyncMetricsTemplateParams,
    useActionScheduleCreateSyncMetricsScheduleApiOrchestratorActionsSchedulesSyncMetricsCreatePost,
    useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost,
    PlatformKind,
    DraftPostPublicationsEnrichedPayload,
    DraftEnrichedPostPublicationsList,
    PostStatus,
    ScheduleTemplateKey,
} from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { AlertTriangle, Info, User, Calendar, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScheduleBuilder } from "./ScheduleBuilder";

const useCreateSyncMetricsSchedule = useActionScheduleCreateSyncMetricsScheduleApiOrchestratorActionsSchedulesSyncMetricsCreatePost;

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
    if (!account) return <div className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-destructive"><AlertTriangle className="h-4 w-4" /><div><p className="font-medium text-sm">No Active Persona</p><p className="text-xs">Please select a persona account first.</p></div></div>;
    return <div className="flex items-center gap-2 rounded-lg border p-2 bg-muted/40"><Avatar className="h-7 w-7"><AvatarImage src={account.persona_avatar_url || undefined} /><AvatarFallback>{account.persona_name?.charAt(0)}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{account.persona_name}</p><p className="text-xs text-muted-foreground">{account.account_handle}</p></div></div>;
}

function ScheduleSummary({ data }: { data: Partial<SyncMetricsBatchRequest> }) {
    const summary = useMemo(() => {
        const { date_range, weekmask, segments } = data;
        if (!date_range?.start || !date_range?.end) return "Please set a start and end date.";
        const avgCount = segments && segments.length > 0 ? Math.round(segments.reduce((acc, s) => acc + (s.count_per_day || 1), 0) / segments.length) : 0;
        const days = weekmask?.join(', ') || 'selected days';
        return `Will sync ~${avgCount} time(s) per day on ${days}, from ${date_range.start} to ${date_range.end}.`;
    }, [data]);
    return <div className="text-xs text-muted-foreground flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Info className="h-3 w-3" /><span>{summary}</span></div>;
}

export function CreateSyncMetricsScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const { personaId, personaAccountId } = usePersonaContextStore();
    const [currentStep, setCurrentStep] = useState(2); // Start from step 2 since step 1 is auto-selected
    const [isReady, setIsReady] = useState(false);
    const [formData, setFormData] = useState<Partial<SyncMetricsBatchRequest>>({});
    const [errors, setErrors] = useState<any>({});

    const createSchedule = useCreateSyncMetricsSchedule();

    const platform = formData.payload_template?.platform as PlatformKind | undefined;

    const publicationsQuery = useBffDraftsListPostPublicationsEnrichedApiBffDraftsPostPublicationsEnrichedPost();

    const publications = publicationsQuery.data;
    const isLoadingPublications = publicationsQuery.isPending;

    const availablePublications = useMemo(() => {
        if (!publications || !personaAccountId) return [];
        // Use enriched publications data - it's already an array
        return publications as DraftEnrichedPostPublicationsList;
    }, [publications, personaAccountId]);

    const fetchPublications = useCallback(() => {
        if (platform && personaAccountId) {
            const payload: DraftPostPublicationsEnrichedPayload = {
                account_persona_id: personaAccountId,
                platform: [platform], // Single platform as array
                status: [PostStatus.published, PostStatus.monitoring], // Only published and monitoring posts
            };
            publicationsQuery.mutate({ data: payload });
        }
    }, [platform, personaAccountId, publicationsQuery.mutate]);

    useEffect(() => {
        fetchPublications();
    }, [fetchPublications]);

    useEffect(() => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + 1);

        const initialPayload: Partial<SyncMetricsTemplateParams> = {
            post_publication_id: undefined, // Changed from 0
            platform: "instagram", // Default value
            persona_account_id: personaAccountId || 0,
        };

        if (personaAccountId) {
            setIsReady(true);
        } else {
            setIsReady(false);
        }

        const initial: Partial<SyncMetricsBatchRequest> = {
            title: "Sync Account Metrics",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            date_range: { start: toYYYYMMDD(startDate), end: toYYYYMMDD(endDate) },
            weekmask: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            segments: [{ id: `default`, start: "00:00:00", end: "23:59:59", count_per_day: 1 }],
            template: ScheduleTemplateKey.insightssync_metrics,
            payload_template: initialPayload as SyncMetricsTemplateParams,
        };
        
        setFormData(initial);
    }, [personaId, personaAccountId]);

    // Update persona_account_id when it changes
    useEffect(() => {
        if (personaAccountId) {
            setFormData(prev => ({
                ...prev,
                payload_template: {
                    ...prev.payload_template,
                    persona_account_id: personaAccountId
                } as SyncMetricsTemplateParams
            }));
        }
    }, [personaAccountId]);

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

    const handlePlatformChange = (value: string) => {
        handleFormChange('payload_template.platform', value);
        handleFormChange('payload_template.post_publication_id', undefined); // Reset publication on platform change
    };

    const handleBatchDataChange = (batchData: Partial<Pick<SyncMetricsBatchRequest, 'date_range' | 'weekmask' | 'segments'>>) => {
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
            const result = await createSchedule.mutateAsync({ data: formData as SyncMetricsBatchRequest });
            toast.success("Sync metrics schedule created successfully.");
            onCreated(result.schedule_ids);
        } catch (error: any) {
            toast.error("Failed to create schedule.", { description: error.message });
        }
    }

    const isStep1Valid = personaAccountId;
    const isStep2Valid = formData.payload_template?.platform && formData.payload_template?.post_publication_id;
    const isStep3Valid = formData.date_range && formData.weekmask && formData.segments;
    const isValid = isStep2Valid;

    const progressValue = ((currentStep - 1) / 2) * 100; // Adjusted for 2 steps instead of 3

    const batchData = {
        date_range: formData.date_range,
        weekmask: formData.weekmask,
        segments: formData.segments,
        template: formData.template,
    };

    return (
        <TooltipProvider>
            <Card className="rounded-xl border bg-card text-card-foreground w-full max-w-4xl mx-auto">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Sync Account Metrics</CardTitle>
                            <CardDescription className="text-sm mt-1">
                                Set up automated metrics synchronization
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-sm">
                            Step {currentStep - 1} of 2
                        </Badge>
                    </div>
                    <Progress value={progressValue} className="mt-4" />
                </CardHeader>
            <CardContent className="p-4">
                {/* Auto-selected Persona Info */}
                <div className="mb-4 p-3 bg-muted/20 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Active Persona</Label>
                    </div>
                    <ContextPersonaDisplay />
                </div>

                {currentStep === 2 && (
                    /* Step 2: Platform & Publication Selection */
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary border-2 border-primary text-primary-foreground text-xs font-semibold">
                                <Target className="h-3 w-3" />
                            </div>
                            <Label className="text-sm font-medium">Choose Target</Label>
                        </div>

                        <div className="grid gap-4 max-w-2xl">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">Platform</Label>
                                    <Select value={formData.payload_template?.platform || ''} onValueChange={handlePlatformChange}>
                                        <SelectTrigger><SelectValue placeholder="Select Platform..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="instagram">Instagram</SelectItem>
                                            <SelectItem value="threads">Threads</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">Post Publication</Label>
                                    <Select
                                        value={formData.payload_template?.post_publication_id?.toString() || ''}
                                        onValueChange={v => handleFormChange('payload_template.post_publication_id', parseInt(v, 10))}
                                        disabled={isLoadingPublications || !availablePublications || availablePublications.length === 0}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select Publication..." /></SelectTrigger>
                                        <SelectContent>
                                            {isLoadingPublications && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                            {availablePublications && availablePublications.map((pub) => (
                                                <Tooltip key={pub.id}>
                                                        <TooltipTrigger asChild>
                                                            <SelectItem value={pub.id.toString()}>
                                                                {pub.title || `Publication #${pub.id}`}
                                                            </SelectItem>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="max-w-sm">
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <p className="font-semibold text-sm">{pub.title || `Publication #${pub.id}`}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {pub.platform} • {pub.status}
                                                                    </p>
                                                                </div>

                                                                {pub.variant_content && (
                                                                    <div>
                                                                        <p className="text-xs font-medium">Content:</p>
                                                                        <p className="text-xs text-muted-foreground line-clamp-3">
                                                                            {pub.variant_content}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {pub.scheduled_at && (
                                                                    <div>
                                                                        <p className="text-xs font-medium">Scheduled:</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {new Date(pub.scheduled_at).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {pub.published_at && (
                                                                    <div>
                                                                        <p className="text-xs font-medium">Published:</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {new Date(pub.published_at).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {pub.permalink && (
                                                                    <div>
                                                                        <p className="text-xs font-medium">Link:</p>
                                                                        <a
                                                                            href={pub.permalink}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-xs text-blue-500 hover:underline break-all"
                                                                        >
                                                                            View Post
                                                                        </a>
                                                                    </div>
                                                                )}

                                                                {pub.tags && pub.tags.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-medium">Tags:</p>
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {pub.tags.slice(0, 3).map((tag, index) => (
                                                                                <span
                                                                                    key={index}
                                                                                    className="text-xs bg-muted px-2 py-1 rounded"
                                                                                >
                                                                                    {tag}
                                                                                </span>
                                                                            ))}
                                                                            {pub.tags.length > 3 && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    +{pub.tags.length - 3} more
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {pub.errors && pub.errors.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-medium text-destructive">Errors:</p>
                                                                        <ul className="text-xs text-destructive">
                                                                            {pub.errors.slice(0, 2).map((error, index) => (
                                                                                <li key={index}>• {error}</li>
                                                                            ))}
                                                                            {pub.errors.length > 2 && (
                                                                                <li>• +{pub.errors.length - 2} more</li>
                                                                            )}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    /* Step 2: Scheduling */
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary border-2 border-primary text-primary-foreground text-xs font-semibold">
                                <Calendar className="h-3 w-3" />
                            </div>
                            <Label className="text-sm font-medium">Schedule Settings</Label>
                        </div>

                        <div className="max-w-2xl">
                            <ScheduleBuilder<SyncMetricsBatchRequest> value={batchData} onChange={handleBatchDataChange} errors={errors} />
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-4 border-t bg-muted/20 flex justify-between">
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
                            disabled={createSchedule.isPending || !isStep3Valid || !isReady || !isValid}
                            className="min-w-32"
                        >
                            {createSchedule.isPending ? "Creating..." : "Create Schedule"}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
        </TooltipProvider>
    );
}

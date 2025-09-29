import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BatchScheduleFormPart } from "./BatchScheduleFormPart";

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
    if (!account) return <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-destructive"><AlertTriangle className="h-6 w-6" /><div><p className="font-semibold">No Active Persona</p><p className="text-xs">Please select a persona account first.</p></div></div>;
    return <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40"><Avatar className="h-9 w-9"><AvatarImage src={account.persona_avatar_url || undefined} /><AvatarFallback>{account.persona_name?.charAt(0)}</AvatarFallback></Avatar><div><p className="font-semibold">{account.persona_name}</p><p className="text-sm text-muted-foreground">{account.account_handle}</p></div></div>;
}

function ScheduleSummary({ data }: { data: Partial<SyncMetricsBatchRequest> }) {
    const summary = useMemo(() => {
        const { date_range, weekmask, segments } = data;
        if (!date_range?.start || !date_range?.end) return "Please set a start and end date.";
        const avgCount = segments && segments.length > 0 ? Math.round(segments.reduce((acc, s) => acc + (s.count_per_day || 1), 0) / segments.length) : 0;
        const days = weekmask?.join(', ') || 'selected days';
        return `Will sync ~${avgCount} time(s) per day on ${days}, from ${date_range.start} to ${date_range.end}.`;
    }, [data]);
    return <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Info className="h-4 w-4" /><span>{summary}</span></div>;
}

export function CreateSyncMetricsScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const { personaId, personaAccountId } = usePersonaContextStore();
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

    const isValid = formData.payload_template?.post_publication_id && formData.payload_template?.platform;

    const batchData = {
        date_range: formData.date_range,
        weekmask: formData.weekmask,
        segments: formData.segments,
        template: formData.template,
    };

    return (
        <TooltipProvider>
            <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-2xl">
                <CardHeader><CardTitle>New Sync Metrics Schedule</CardTitle><CardDescription>Configure a recurring schedule to sync account metrics.</CardDescription></CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="p-6">
                    <Accordion type="multiple" defaultValue={["item-1", "item-2"]} className="w-full">
                        <AccordionItem value="item-1"><AccordionTrigger>1. Target Account & Publication</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid gap-2"><Label>Persona Account</Label><ContextPersonaDisplay /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Platform</Label>
                                        <Select value={formData.payload_template?.platform || ''} onValueChange={handlePlatformChange}>
                                            <SelectTrigger><SelectValue placeholder="Select Platform..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="instagram">Instagram</SelectItem>
                                                <SelectItem value="threads">Threads</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Post Publication</Label>
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
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2"><AccordionTrigger>2. Scheduling</AccordionTrigger>
                            <AccordionContent className="pt-4">
                                <BatchScheduleFormPart<SyncMetricsBatchRequest> value={batchData} onChange={handleBatchDataChange} errors={errors} />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                <CardFooter className="px-6 py-4 border-t flex flex-col items-start gap-3">
                    <ScheduleSummary data={formData} />
                    <div className="w-full flex justify-end">
                        <Button type="submit" disabled={createSchedule.isPending || !isReady || !isValid}>{createSchedule.isPending ? "Creating..." : "Create Schedule"}</Button>
                    </div>
                </CardFooter>
            </form>
        </Card>
        </TooltipProvider>
    );
}

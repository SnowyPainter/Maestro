import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DraftPostScheduleRequest, useBffDraftsListDraftsApiBffDraftsGet, useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet, DraftVariantRender, useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Instagram, Twitter, Facebook, Linkedin, Newspaper, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Eye, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const platformIcons: { [key: string]: React.ReactNode } = {
    instagram: <Instagram className="h-5 w-5 text-muted-foreground" />,
    twitter: <Twitter className="h-5 w-5 text-muted-foreground" />,
    facebook: <Facebook className="h-5 w-5 text-muted-foreground" />,
    linkedin: <Linkedin className="h-5 w-5 text-muted-foreground" />,
    web: <Newspaper className="h-5 w-5 text-muted-foreground" />,
};

function PlatformSpecificPreview({ variant }: { variant: DraftVariantRender }) {
    const media = variant.rendered_blocks?.media?.filter(r => r.type === 'image' || r.type === 'video') || [];
    const caption = variant.rendered_caption || '';
    const platform = variant.platform.toLowerCase();
    const Icon = platformIcons[platform] || platformIcons.web;

    const Header = () => (
        <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
            {Icon}
            <span className="font-semibold capitalize text-foreground">{variant.platform}</span>
        </div>
    );

    const Caption = () => (
        <p className="text-sm whitespace-pre-wrap text-foreground/90">{caption}</p>
    );

    const MediaGrid = () => (
        <div className="grid gap-2 grid-cols-2">
            {media.map((block, index) => (
                <img key={index} src={block.url} alt="variant media" className="rounded-lg object-cover w-full aspect-square" />
            ))}
        </div>
    );
    
    const SingleMedia = () => (
        media.length > 0 ? <img src={media[0].url} alt="variant media" className="rounded-lg object-cover w-full" /> : null
    );

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <Header />
            <div className="p-3">
                {media.length > 0 && (media.length > 1 ? <MediaGrid /> : <SingleMedia />)}
                <div className={cn(media.length > 0 ? "mt-2" : "mt-0")}>
                    <Caption />
                </div>
            </div>
        </div>
    );
}

export function CreatePostScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [draftId, setDraftId] = useState<number | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<DraftVariantRender | null>(null);
    const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
    const [time, setTime] = useState("");
    const { personaAccountId } = usePersonaContextStore();

    const { data: drafts, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet();
    const { data: variants, isLoading: isLoadingVariants } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId!, {
        query: { enabled: !!draftId }
    });

    const createScheduleMutation = useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost();

    const handleDraftSelect = (id: number) => {
        setDraftId(id);
        setSelectedVariant(null);
        setCurrentVariantIndex(0);
        setCurrentStep(2);
    };

    const handleVariantSelect = (variant: DraftVariantRender) => {
        setSelectedVariant(variant);
        setCurrentStep(3);
    };

    const handleTimeSelect = () => {
        setCurrentStep(4);
    };

    const handleSchedule = async () => {
        if (!selectedVariant || !personaAccountId || !time) {
            toast.error("Please complete all steps: select a draft, a variant, and a time.");
            return;
        }

        const runAt = new Date(time).toISOString();

        const payload: DraftPostScheduleRequest = {
            variant_id: selectedVariant.variant_id,
            persona_account_id: personaAccountId,
            run_at: runAt,
        };

        try {
            const result = await createScheduleMutation.mutateAsync({ data: payload });
            toast.success("Post successfully scheduled.");
            onCreated(result.schedule_ids);
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail?.[0]?.msg || error.message || "An unknown error occurred.";
            toast.error("Failed to schedule post.", { description: errorMsg });
        }
    };

    const isPending = createScheduleMutation.isPending;
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const progressValue = (currentStep / 4) * 100;
    const selectedDraft = drafts?.find(d => d.id === draftId);

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-5xl mx-auto">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">Schedule a New Post</CardTitle>
                        <CardDescription className="text-base mt-1">
                            Create and schedule content across multiple platforms
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm">
                        Step {currentStep} of 4
                    </Badge>
                </div>
                <Progress value={progressValue} className="mt-4" />
            </CardHeader>

            <CardContent className="p-6">
                {currentStep === 1 && (
                    /* Step 1: Draft Selection */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <FileText className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Choose a Draft</Label>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {isLoadingDrafts && (
                                <div className="col-span-full p-8 text-center text-muted-foreground">
                                    <div className="animate-pulse">Loading drafts...</div>
                                </div>
                            )}

                            {drafts?.map(draft => (
                                <Card
                                    key={draft.id}
                                    className={cn(
                                        "cursor-pointer transition-all hover:shadow-md",
                                        draftId === draft.id
                                            ? "ring-2 ring-primary bg-primary/5"
                                            : "hover:bg-muted/50"
                                    )}
                                    onClick={() => handleDraftSelect(draft.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-sm mb-1">
                                                    {draft.title || `Draft #${draft.id}`}
                                                </h3>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {draft.goal || "No goal specified"}
                                                </p>
                                            </div>
                                            {draftId === draft.id && (
                                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 2 && draftId && (
                    /* Step 2: Variant Selection */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <Eye className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Select Platform Variant</Label>
                        </div>

                        {isLoadingVariants && (
                            <div className="p-8 text-center text-muted-foreground">
                                <div className="animate-pulse">Loading variants...</div>
                            </div>
                        )}

                        {variants && variants.length > 0 && (
                            <div className="space-y-4">
                                {/* Current variant preview - larger and more prominent */}
                                <div className="flex justify-center">
                                    <div className="w-full max-w-md">
                                        <PlatformSpecificPreview variant={variants[currentVariantIndex]} />
                                    </div>
                                </div>

                                {/* Variant selector buttons */}
                                <div className="flex items-center justify-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentVariantIndex(prev =>
                                            prev === 0 ? variants.length - 1 : prev - 1
                                        )}
                                        disabled={variants.length <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    <div className="flex items-center gap-2 min-w-32 justify-center">
                                        {variants.map((variant, index) => (
                                            <button
                                                key={variant.variant_id}
                                                className={cn(
                                                    "w-2 h-2 rounded-full transition-colors",
                                                    index === currentVariantIndex
                                                        ? "bg-primary"
                                                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                                )}
                                                onClick={() => setCurrentVariantIndex(index)}
                                            />
                                        ))}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentVariantIndex(prev =>
                                            prev === variants.length - 1 ? 0 : prev + 1
                                        )}
                                        disabled={variants.length <= 1}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="text-center text-sm text-muted-foreground">
                                    {variants[currentVariantIndex].platform} • Variant {currentVariantIndex + 1} of {variants.length}
                                </div>

                                <div className="flex justify-center">
                                    <Button
                                        onClick={() => handleVariantSelect(variants[currentVariantIndex])}
                                        className="w-full max-w-sm"
                                    >
                                        Select This Variant
                                    </Button>
                                </div>
                            </div>
                        )}

                        {variants && variants.length === 0 && !isLoadingVariants && (
                            <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg">
                                No variants found for this draft.
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 3 && selectedVariant && (
                    /* Step 3: Time Selection */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Schedule Time</Label>
                        </div>

                        <div className="max-w-md mx-auto">
                            <Card>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="schedule-time" className="text-sm font-medium">
                                            Publication Time
                                        </Label>
                                        <Input
                                            id="schedule-time"
                                            type="datetime-local"
                                            value={time}
                                            onChange={e => setTime(e.target.value)}
                                            disabled={!personaAccountId}
                                            className="text-base"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Timezone: {timezoneName}
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleTimeSelect}
                                        disabled={!time || !personaAccountId}
                                        className="w-full"
                                    >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Set Time & Continue
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {currentStep === 4 && time && selectedVariant && (
                    /* Step 4: Confirmation */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Confirm & Schedule</Label>
                        </div>

                        <Card className="bg-muted/20">
                            <CardContent className="p-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="font-semibold mb-2">Draft Details</h3>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <p><strong>Title:</strong> {selectedDraft?.title || `Draft #${selectedDraft?.id}`}</p>
                                                <p><strong>Platform:</strong> {selectedVariant.platform}</p>
                                                <p><strong>Time:</strong> {new Date(time).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-2">Preview</h3>
                                            <div className="max-w-sm">
                                                <PlatformSpecificPreview variant={selectedVariant} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {!personaAccountId && (
                    <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                        <p className="text-sm text-destructive font-medium">
                            A persona must be active to schedule a post.
                        </p>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-6 border-t bg-muted/20 flex justify-between">
                <div className="flex gap-2">
                    {currentStep > 1 && (
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={isPending}
                        >
                            Previous
                        </Button>
                    )}
                </div>

                <div className="flex gap-2">
                    {currentStep === 2 && variants && variants.length > 0 && (
                        <Button
                            onClick={() => handleVariantSelect(variants[currentVariantIndex])}
                            disabled={isPending}
                        >
                            Select This Variant
                        </Button>
                    )}

                    {currentStep === 3 && (
                        <Button
                            onClick={handleTimeSelect}
                            disabled={isPending || !time || !personaAccountId}
                        >
                            Set Time & Continue
                        </Button>
                    )}

                    {currentStep === 4 && (
                        <Button
                            onClick={handleSchedule}
                            disabled={isPending || !time || !selectedVariant || !personaAccountId}
                            className="min-w-32"
                        >
                            {isPending ? "Scheduling..." : "Schedule Post"}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
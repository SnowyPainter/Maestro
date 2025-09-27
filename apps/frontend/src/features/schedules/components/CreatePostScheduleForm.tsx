import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DraftPostScheduleRequest, useBffDraftsListDraftsApiBffDraftsGet, useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet, DraftVariantRender, useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Instagram, Twitter, Facebook, Linkedin, Newspaper, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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
    const [draftId, setDraftId] = useState<number | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
    const [time, setTime] = useState("");
    const { personaAccountId } = usePersonaContextStore();

    const { data: drafts, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet();
    const { data: variants, isLoading: isLoadingVariants } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId!, {
        query: { enabled: !!draftId }
    });

    useEffect(() => {
        if (variants && variants.length > 0) {
            setVariantId(variants[currentVariantIndex]?.variant_id ?? null);
        } else {
            setVariantId(null);
        }
    }, [currentVariantIndex, variants]);

    const handlePrevVariant = () => {
        if (!variants) return;
        setCurrentVariantIndex(prev => (prev === 0 ? variants.length - 1 : prev - 1));
    };

    const handleNextVariant = () => {
        if (!variants) return;
        setCurrentVariantIndex(prev => (prev === variants.length - 1 ? 0 : prev + 1));
    };

    const createScheduleMutation = useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost();

    const handleSchedule = async () => {
        if (!draftId || !variantId || !personaAccountId || !time) {
            toast.error("Please complete all steps: select a draft, a variant, and a time.");
            return;
        }

        const runAt = new Date(time).toISOString();

        const payload: DraftPostScheduleRequest = {
            variant_id: variantId,
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
    
    const currentVariant = variants?.[currentVariantIndex];

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-2xl">
            <CardHeader>
                <CardTitle>Schedule a New Post</CardTitle>
                <CardDescription>Follow the steps to select a draft, choose a platform variant, and set the publication time.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Step 1: Draft Selection */}
                <div className="space-y-3">
                    <Label htmlFor="draft-select" className="text-base font-semibold">Step 1: Select a Draft</Label>
                    <ScrollArea className="h-40 w-full rounded-md border">
                        <div className="p-2 space-y-1">
                            {isLoadingDrafts && <p className="p-4 text-center text-sm text-muted-foreground">Loading drafts...</p>}
                            {drafts?.map(draft => (
                                <button
                                    key={draft.id}
                                    className={cn(
                                        "w-full text-left p-2 rounded-md transition-colors flex items-center justify-between",
                                        draftId === draft.id ? "bg-secondary text-secondary-foreground" : "hover:bg-muted/50"
                                    )}
                                    onClick={() => { setDraftId(draft.id); setCurrentVariantIndex(0); }}
                                >
                                    <span>{draft.title || `Draft #${draft.id}`}</span>
                                    {draftId === draft.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Step 2: Variant Selection Stepper */}
                {draftId && (
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Step 2: Choose a Variant</Label>
                        {isLoadingVariants && <p className="p-4 text-center text-sm text-muted-foreground">Loading variants...</p>}
                        {variants && variants.length > 0 && currentVariant && (
                             <div className="space-y-3">
                                <div className="flex items-center justify-center space-x-2">
                                    <Button variant="outline" size="icon" onClick={handlePrevVariant} disabled={variants.length <= 1}>
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>

                                    <div className="w-full max-w-sm">
                                        <PlatformSpecificPreview variant={currentVariant} />
                                    </div>

                                    <Button variant="outline" size="icon" onClick={handleNextVariant} disabled={variants.length <= 1}>
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                                <div className="text-center text-sm text-muted-foreground">
                                    {`Variant ${currentVariantIndex + 1} of ${variants.length}`}
                                </div>
                            </div>
                        )}
                         {variants && variants.length === 0 && !isLoadingVariants && (
                            <div className="p-4 text-center text-sm text-muted-foreground bg-muted/50 rounded-md">
                                No variants found for this draft.
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Time Selection */}
                {variantId && (
                    <div className="space-y-3">
                        <Label htmlFor="schedule-time" className="text-base font-semibold">
                            Step 3: Set Schedule Time
                            <span className="ml-2 text-xs font-normal text-muted-foreground">({timezoneName})</span>
                        </Label>
                        <Input
                            id="schedule-time"
                            type="datetime-local"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            disabled={!personaAccountId}
                            className="max-w-sm"
                        />
                    </div>
                )}

                {!personaAccountId && <p className="text-sm text-destructive text-center pt-2">A persona must be active to schedule a post.</p>}

            </CardContent>
            <CardFooter className="p-6 border-t flex justify-end">
                <Button onClick={handleSchedule} disabled={isPending || !draftId || !variantId || !time || !personaAccountId}>
                    {isPending ? "Scheduling..." : "Schedule Post"}
                </Button>
            </CardFooter>
        </Card>
    );
}
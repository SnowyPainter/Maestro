import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DraftPostScheduleRequest,useBffDraftsListDraftsApiBffDraftsGet, useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet, DraftIRBlocksItem, DraftVariantRender, useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Instagram, Twitter, Facebook, Linkedin, Newspaper } from "lucide-react";

const platformIcons: { [key: string]: React.ReactNode } = {
    instagram: <Instagram className="h-5 w-5 text-[#E1306C]" />,
    twitter: <Twitter className="h-5 w-5 text-[#1DA1F2]" />,
    facebook: <Facebook className="h-5 w-5 text-[#1877F2]" />,
    linkedin: <Linkedin className="h-5 w-5 text-[#0A66C2]" />,
    web: <Newspaper className="h-5 w-5" />,
};

function PlatformSpecificPreview({ variant }: { variant: DraftVariantRender }) {
    const media = variant.rendered_blocks?.media?.filter(r => r.type === 'image' || r.type === 'video') || [];
    const caption = variant.rendered_caption || '';
    const platform = variant.platform.toLowerCase();
    const Icon = platformIcons[platform] || platformIcons.web;

    const Header = () => (
        <div className="flex items-center gap-2 text-foreground">
            {Icon}
            <span className="font-semibold capitalize">{variant.platform}</span>
        </div>
    );

    const Caption = () => (
        <p className="text-sm whitespace-pre-wrap text-foreground/90">{caption}</p>
    );

    const MediaGrid = () => (
        <div className="mt-2 grid gap-2 grid-cols-2">
            {media.map(block => (
                <img src={block.url} alt="variant media" className="rounded-lg object-cover w-full aspect-square" />
            ))}
        </div>
    );
    
    const SingleMedia = () => (
        media.length > 0 ? <img src={media[0].url} alt="variant media" className="rounded-lg object-cover w-full mt-2" /> : null
    );


    switch (platform) {
        case 'instagram':
            return (
                <div className="bg-background p-3 rounded-lg border">
                    <Header />
                    {media.length > 1 ? <MediaGrid /> : <SingleMedia />}
                    <div className="mt-2">
                       <Caption />
                    </div>
                </div>
            );
        case 'twitter':
             return (
                <div className="bg-background p-3 rounded-lg border">
                    <Header />
                    <div className="mt-1">
                        <Caption />
                        {media.length > 1 ? <MediaGrid /> : <SingleMedia />}
                    </div>
                </div>
            );
        default: // facebook, linkedin, etc.
            return (
                <div className="bg-background p-3 rounded-lg border">
                    <Header />
                     <div className="mt-1">
                        <Caption />
                        {media.length > 1 ? <MediaGrid /> : <SingleMedia />}
                    </div>
                </div>
            );
    }
}

function VariantPreview({ variant }: { variant: DraftVariantRender }) {
    return (
        <div className="mt-4">
            <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Preview</h4>
            <PlatformSpecificPreview variant={variant} />
        </div>
    );
}


export function CreatePostScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const [draftId, setDraftId] = useState<number | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [time, setTime] = useState("");
    const { personaAccountId } = usePersonaContextStore();

    const { data: drafts, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet();
    const { data: variants, isLoading: isLoadingVariants } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId!, {
        query: { enabled: !!draftId }
    });

    const createScheduleMutation = useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost();

    const selectedVariant = useMemo(() => {
        if (!variants || !variantId) return null;
        return variants.find(v => v.variant_id === variantId) ?? null;
    }, [variants, variantId]);

    const handleSchedule = async () => {
        if (!draftId || !variantId || !personaAccountId || !time) {
            toast.error("Please fill all fields: select a draft, a variant, and a time.");
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

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-lg">
            <CardHeader>
                <CardTitle>Schedule a New Post</CardTitle>
                <CardDescription>Select a draft, choose a variant, and set the publication time.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="draft-select">Draft</Label>
                        <Select onValueChange={(val) => { setDraftId(Number(val)); setVariantId(null); }} disabled={isLoadingDrafts}>
                            <SelectTrigger id="draft-select">
                                <SelectValue placeholder="Select a draft..." />
                            </SelectTrigger>
                            <SelectContent>
                                {drafts?.map(draft => (
                                    <SelectItem key={draft.id} value={String(draft.id)}>{draft.title || `Draft #${draft.id}`}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="variant-select">Variant</Label>
                        <Select onValueChange={(val) => setVariantId(Number(val))} disabled={!draftId || isLoadingVariants} value={variantId ? String(variantId) : undefined}>
                            <SelectTrigger id="variant-select">
                                <SelectValue placeholder={!draftId ? "Select draft first" : "Select a variant..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {variants?.map(variant => (
                                    <SelectItem key={variant.variant_id} value={String(variant.variant_id)}>{variant.platform}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="schedule-time">
                        Scheduled Time
                        <span className="ml-2 text-xs text-muted-foreground">({timezoneName})</span>
                    </Label>
                    <Input
                        id="schedule-time"
                        type="datetime-local"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        disabled={!personaAccountId}
                    />
                </div>

                {selectedVariant && <VariantPreview variant={selectedVariant} />}

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
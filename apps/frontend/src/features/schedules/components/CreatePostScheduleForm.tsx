import { useState, useEffect, useMemo } from "react";
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
import { Instagram, Twitter, Facebook, Linkedin, Newspaper, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Eye, Calendar, Search, Grid3X3 } from "lucide-react";
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
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const { personaAccountId } = usePersonaContextStore();

    const { data: drafts, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet();
    const { data: variants, isLoading: isLoadingVariants } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId!, {
        query: { enabled: !!draftId }
    });

    const createScheduleMutation = useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost();

    // Filter drafts based on search query
    const filteredDrafts = useMemo(() => {
        if (!drafts) return [];
        if (!searchQuery.trim()) return drafts;

        const query = searchQuery.toLowerCase();
        return drafts.filter(draft =>
            (draft.title?.toLowerCase().includes(query)) ||
            (draft.goal?.toLowerCase().includes(query)) ||
            draft.id.toString().includes(query)
        );
    }, [drafts, searchQuery]);

    // Paginate filtered drafts (9 per page for 3x3 grid)
    const draftsPerPage = 9;
    const totalPages = Math.ceil(filteredDrafts.length / draftsPerPage);
    const startIndex = currentPage * draftsPerPage;
    const paginatedDrafts = filteredDrafts.slice(startIndex, startIndex + draftsPerPage);

    const handleDraftSelect = (id: number) => {
        setDraftId(id);
        setSelectedVariant(null);
        setCurrentVariantIndex(0);
        setCurrentStep(2);
        setCurrentPage(0); // Reset pagination when selecting a draft
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(0, prev - 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
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
                    /* Step 1: Draft Selection with Search & Carousel */
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary border-2 border-primary text-primary-foreground text-sm font-semibold">
                                <FileText className="h-4 w-4" />
                            </div>
                            <Label className="text-lg font-semibold">Choose a Draft</Label>
                        </div>

                        {/* Search Bar */}
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Search drafts by title, goal, or ID..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(0); // Reset to first page when searching
                                }}
                                className="pl-10"
                            />
                        </div>

                        {/* Results Summary */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                                {isLoadingDrafts ? "Loading..." :
                                 `${filteredDrafts.length} draft${filteredDrafts.length !== 1 ? 's' : ''} found`}
                            </span>
                            {filteredDrafts.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Grid3X3 className="h-4 w-4" />
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                            )}
                        </div>

                        {/* Draft Grid Carousel */}
                        {isLoadingDrafts && (
                            <div className="grid grid-cols-3 gap-3">
                                {Array.from({ length: 9 }).map((_, index) => (
                                    <Card key={index} className="animate-pulse">
                                        <CardContent className="p-4">
                                            <div className="space-y-2">
                                                <div className="h-4 bg-muted rounded"></div>
                                                <div className="h-3 bg-muted rounded w-3/4"></div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {!isLoadingDrafts && filteredDrafts.length > 0 && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    {paginatedDrafts.map(draft => (
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
                                                <div className="space-y-2">
                                                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                                                        {draft.title || `Draft #${draft.id}`}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {draft.goal || "No goal specified"}
                                                    </p>
                                                    {draftId === draft.id && (
                                                        <div className="flex justify-end">
                                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {/* Fill empty slots for consistent grid */}
                                    {Array.from({ length: draftsPerPage - paginatedDrafts.length }).map((_, index) => (
                                        <div key={`empty-${index}`} className="invisible"></div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={currentPage === 0}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                                                const pageIndex = Math.max(0, Math.min(totalPages - 5, currentPage - 2)) + index;
                                                if (pageIndex >= totalPages) return null;

                                                return (
                                                    <Button
                                                        key={pageIndex}
                                                        variant={currentPage === pageIndex ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageIndex)}
                                                        className="w-8 h-8 p-0"
                                                    >
                                                        {pageIndex + 1}
                                                    </Button>
                                                );
                                            })}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={currentPage === totalPages - 1}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}

                        {!isLoadingDrafts && filteredDrafts.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No drafts found</p>
                                <p className="text-sm">
                                    {searchQuery ? "Try adjusting your search terms" : "Create your first draft to get started"}
                                </p>
                            </div>
                        )}
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
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="schedule-time" className="text-sm font-medium">
                                                Publication Time
                                            </Label>
                                            <Button variant="link" size="sm" onClick={() => {
                                                const now = new Date();
                                                now.setMinutes(now.getMinutes() + 10);
                                                now.setSeconds(0, 0);
                                                const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                                                setTime(local.toISOString().slice(0, 16));
                                            }} className="p-0 h-auto" type="button">
                                                Now
                                            </Button>
                                        </div>
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
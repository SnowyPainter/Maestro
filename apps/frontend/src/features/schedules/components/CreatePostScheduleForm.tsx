import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DraftPostScheduleRequest, useBffDraftsListDraftsApiBffDraftsGet, useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet, DraftVariantRender, useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost, useBffPlaybookSearchPlaybooksApiBffPlaybooksSearchGet } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Search, Grid3X3, Calendar, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DraftVariantPreview } from "./DraftVariantPreview";
import { Skeleton } from "@/components/ui/skeleton";

export function CreatePostScheduleForm({ onCreated }: { onCreated: (scheduleIds: number[]) => void }) {
    const [draftId, setDraftId] = useState<number | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<DraftVariantRender | null>(null);
    const [time, setTime] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const { personaAccountId, accountPlatform, campaignId } = usePersonaContextStore();

    const { data: drafts, isLoading: isLoadingDrafts } = useBffDraftsListDraftsApiBffDraftsGet();
    const { data: variants, isLoading: isLoadingVariants } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId!, {
        query: { enabled: !!draftId }
    });

    // 플레이북 정보를 가져와서 best_window 활용
    const { data: playbooks } = useBffPlaybookSearchPlaybooksApiBffPlaybooksSearchGet(
        { campaign_id: campaignId || undefined },
        { query: { enabled: !!campaignId } }
    );

    const createScheduleMutation = useActionScheduleCreateDraftPostScheduleApiOrchestratorActionsSchedulesCreateDraftPostPost();

    // best_time_window를 활용하여 최적 시간을 계산하는 함수
    const calculateBestWindowTime = (): Date | null => {
        if (!playbooks?.items || playbooks.items.length === 0) return null;

        // 현재 활성화된 플레이북 찾기 (첫 번째 플레이북 사용)
        const activePlaybook = playbooks.items[0];

        // best_time_window 정보가 있는지 확인 (API에 best_window 대신 best_time_window로 저장됨)
        const bestTimeWindow = (activePlaybook as any)?.best_time_window;
        if (!bestTimeWindow) return null;

        try {
            // best_time_window가 "Sat 09:00" 형식이라고 가정
            const [dayOfWeek, timeStr] = bestTimeWindow.split(' ');
            const [hours, minutes] = timeStr.split(':').map(Number);

            // 요일을 숫자로 변환 (0 = 일요일, 1 = 월요일, ..., 6 = 토요일)
            const dayMap: Record<string, number> = {
                'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
            };

            const targetDayOfWeek = dayMap[dayOfWeek];
            if (targetDayOfWeek === undefined) {
                throw new Error(`Invalid day of week: ${dayOfWeek}`);
            }

            const now = new Date();
            const currentDayOfWeek = now.getDay();
            let daysToAdd = targetDayOfWeek - currentDayOfWeek;

            // 이미 지난 요일이면 다음 주로
            if (daysToAdd < 0) {
                daysToAdd += 7;
            }

            // 같은 요일인 경우
            if (daysToAdd === 0) {
                // 오늘의 해당 시간으로 설정해보고
                const todayTime = new Date(now);
                todayTime.setHours(hours, minutes, 0, 0);

                // 이미 지났으면 다음 주로
                if (todayTime <= now) {
                    daysToAdd = 7;
                }
            }

            // 최적 시간 계산
            const bestTime = new Date(now);
            bestTime.setDate(now.getDate() + daysToAdd);
            bestTime.setHours(hours, minutes, 0, 0);

            // 2주 이내로 제한 (다음 주까지만)
            const twoWeeksLater = new Date(now);
            twoWeeksLater.setDate(now.getDate() + 14);

            return bestTime <= twoWeeksLater ? bestTime : null;
        } catch (error) {
            console.error('Failed to parse best_time_window:', error, bestTimeWindow);
            return null;
        }
    };

    useEffect(() => {
        if (variants && accountPlatform) {
            const matchingVariant = variants.find(v => v.platform.toLowerCase() === accountPlatform.toLowerCase());
            setSelectedVariant(matchingVariant || null);
        } else {
            setSelectedVariant(null);
        }
    }, [variants, accountPlatform]);

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

    const draftsPerPage = 9;
    const totalPages = Math.ceil(filteredDrafts.length / draftsPerPage);
    const startIndex = currentPage * draftsPerPage;
    const paginatedDrafts = filteredDrafts.slice(startIndex, startIndex + draftsPerPage);

    const handleDraftSelect = (id: number) => {
        setDraftId(id);
        setCurrentPage(0);
    };

    const handleBackToDraftSelection = () => {
        setDraftId(null);
        setSearchQuery("");
        setCurrentPage(0);
    };

    const handlePrevPage = () => setCurrentPage(prev => Math.max(0, prev - 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));

    const handleSchedule = async () => {
        if (!selectedVariant || !personaAccountId || !time) {
            toast.error("Please select a draft, and a time.");
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

    return (
        <Card className="rounded-2xl border bg-card text-card-foreground shadow-md w-full max-w-5xl mx-auto">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">Schedule a New Post</CardTitle>
                        <CardDescription className="text-base mt-1">
                            {draftId ? "Set the time and confirm your post" : "Choose a draft to get started"}
                        </CardDescription>
                    </div>
                    {draftId && (
                        <Button variant="outline" onClick={handleBackToDraftSelection} disabled={isPending}>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Change Draft
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-6">
                {!draftId ? (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <Label className="text-lg font-semibold">Choose a Draft</Label>
                        </div>
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Search drafts by title, goal, or ID..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{isLoadingDrafts ? "Loading..." : `${filteredDrafts.length} draft${filteredDrafts.length !== 1 ? 's' : ''} found`}</span>
                            {filteredDrafts.length > draftsPerPage && (
                                <span className="flex items-center gap-1"><Grid3X3 className="h-4 w-4" /> Page {currentPage + 1} of {totalPages}</span>
                            )}
                        </div>
                        {isLoadingDrafts ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {Array.from({ length: 9 }).map((_, index) => <Skeleton key={index} className="h-24" />)}
                            </div>
                        ) : filteredDrafts.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {paginatedDrafts.map(draft => (
                                        <Card key={draft.id} className="cursor-pointer transition-all hover:shadow-md hover:bg-muted/50" onClick={() => handleDraftSelect(draft.id)}>
                                            <CardContent className="p-4">
                                                <div className="space-y-2">
                                                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{draft.title || `Draft #${draft.id}`}</h3>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{draft.goal || "No goal specified"}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 0}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                                        <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {totalPages}</span>
                                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages - 1}>Next <ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium mb-2">No drafts found</p><p className="text-sm">{searchQuery ? "Try adjusting your search terms" : "Create your first draft to get started"}</p></div>
                        )}
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-lg font-semibold flex items-center gap-2">
                                Preview for <Badge variant="outline" className="capitalize">{accountPlatform}</Badge>
                            </Label>
                            <div className="w-full max-w-md mx-auto">
                                {isLoadingVariants && (
                                    <div className="space-y-4">
                                        <Skeleton className="h-8 w-1/3" />
                                        <Skeleton className="w-full aspect-square" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                )}
                                {!isLoadingVariants && selectedVariant && <DraftVariantPreview variant={selectedVariant} />}
                                {!isLoadingVariants && !selectedVariant && (
                                    <Card className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 border-dashed">
                                        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                                        <CardTitle className="text-lg text-destructive">No Compatible Variant</CardTitle>
                                        <CardDescription className="mt-2">
                                            This draft does not have a variant for the selected persona's platform ({accountPlatform}).
                                        </CardDescription>
                                    </Card>
                                )}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="schedule-time" className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Schedule Time</Label>
                                <Input id="schedule-time" type="datetime-local" value={time} onChange={e => setTime(e.target.value)} disabled={!personaAccountId || !selectedVariant} className="text-base" />
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const now = new Date();
                                            // 최소 5분 후로 설정 (즉시 실행 방지)
                                            now.setMinutes(now.getMinutes() + 5);
                                            setTime(now.toISOString().slice(0, 16));
                                        }}
                                        disabled={!personaAccountId || !selectedVariant}
                                        className="text-xs"
                                    >
                                        <Clock className="h-3 w-3 mr-1" />
                                        Now
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const bestTime = calculateBestWindowTime();
                                            if (bestTime) {
                                                setTime(bestTime.toISOString().slice(0, 16));
                                                toast.success("Best window time set!", {
                                                    description: `Scheduled for ${bestTime.toLocaleDateString()} at ${bestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                });
                                            } else {
                                                // best_window 정보가 없으면 기본값으로 설정
                                                const tomorrow = new Date();
                                                tomorrow.setDate(tomorrow.getDate() + 1);
                                                tomorrow.setHours(10, 0, 0, 0);
                                                setTime(tomorrow.toISOString().slice(0, 16));
                                                toast.info("Using default optimal time", {
                                                    description: "Best window data not available. Using tomorrow at 10 AM as default."
                                                });
                                            }
                                        }}
                                        disabled={!personaAccountId || !selectedVariant}
                                        className="text-xs"
                                    >
                                        <Zap className="h-3 w-3 mr-1" />
                                        Set Best Window
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Timezone: {timezoneName}</p>
                            </div>
                            {!personaAccountId && (
                                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                                    <p className="text-sm text-destructive font-medium">A persona must be active to schedule a post.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>

            {draftId && (
                <CardFooter className="p-6 border-t bg-muted/20 flex justify-end">
                    <Button onClick={handleSchedule} disabled={isPending || !time || !selectedVariant || !personaAccountId} className="min-w-40">
                        {isPending ? "Scheduling..." : "Schedule Post"}
                        <Clock className="h-4 w-4 ml-2" />
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

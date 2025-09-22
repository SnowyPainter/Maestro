import { useMemo, useEffect, useState, useCallback } from "react";
import { AlertTriangle, Loader2, RefreshCw, FileWarning, CheckCircle2, Clock, X, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet,
  useDraftsToggleReadyApiOrchestratorDraftsDraftIdVariantsPlatformReadyPut,
  RenderedVariantBlocks,
  PlatformKind,
  DraftVariantReadyCommand,
  PostPublicationOut,
} from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ensurePlatformKind,
  formatCompiledAt,
  platformPresentation,
  countListItems,
  DraftVariantRender,
} from "../draftVariant";

const STATUS_BADGES: Record<string, string> = {
  valid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-900",
  rendered: "bg-indigo-100 text-indigo-900",
  invalid: "bg-rose-100 text-rose-900",
};

const READY_LOCKED_STATUSES = new Set(["published", "monitoring"]);
const READY_ACTIVE_STATUSES = new Set(["scheduled", "published", "monitoring"]);

function toLocalInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string {
  const date = new Date(value);
  return date.toISOString();
}

function defaultScheduleLocal(): string {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 10);
  next.setSeconds(0, 0);
  const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatScheduleDisplay(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && error !== null) {
    const anyError = error as { data?: any; message?: string };
    const detail = anyError.data?.detail;
    if (typeof detail === "string" && detail) {
      return detail;
    }
    if (typeof anyError.message === "string" && anyError.message) {
      return anyError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to update ready state";
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: DraftVariantRender;
  currentSchedule: string;
  onScheduleChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  platformLabel: string;
}

function ScheduleDialog({
  open,
  onOpenChange,
  variant,
  currentSchedule,
  onScheduleChange,
  onSave,
  isSaving,
  platformLabel,
}: ScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>
            Set a schedule time for your {platformLabel} post.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="schedule-time" className="text-right text-sm font-medium">
              Time
            </label>
            <Input
              id="schedule-time"
              type="datetime-local"
              value={currentSchedule}
              onChange={(e) => onScheduleChange(e.target.value)}
              className="col-span-3"
            />
          </div>
          {variant.post_publication_scheduled_at && (
            <div className="text-sm text-muted-foreground">
              Currently scheduled: {formatScheduleDisplay(variant.post_publication_scheduled_at)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function mediaSummary(blocks: RenderedVariantBlocks | null | undefined) {
  const count = blocks?.media?.length ?? 0;
  return count === 0 ? "No media" : `${count} media ${(count === 1 ? "item" : "items")}`;
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  return STATUS_BADGES[normalized] ?? "bg-muted text-muted-foreground";
}

function getStatusIcon(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />;
    case 'valid':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />;
    case 'invalid':
      return <X className="h-4 w-4 text-red-600 flex-shrink-0" />;
    case 'rendered':
      return <CheckCircle className="h-4 w-4 text-indigo-600 flex-shrink-0" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
}

export function DraftVariantList({
  draftId,
  variants: providedVariants,
  onSelect,
  compact = false,
}: {
  draftId?: number;
  variants?: DraftVariantRender[];
  onSelect?: (variant: DraftVariantRender) => void;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId || 0, {
    query: {
      enabled: draftId !== undefined && draftId !== null && !providedVariants,
    },
  });

  const variants = useMemo(() => providedVariants ?? data ?? [], [providedVariants, data]);
  const [scheduleInputs, setScheduleInputs] = useState<Record<number, string>>({});
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedVariantForSchedule, setSelectedVariantForSchedule] = useState<DraftVariantRender | null>(null);
  const toggleReadyMutation = useDraftsToggleReadyApiOrchestratorDraftsDraftIdVariantsPlatformReadyPut();

  const hasDraftContext = typeof draftId === "number" && !Number.isNaN(draftId);
  const isMutating = toggleReadyMutation.isPending;

  useEffect(() => {
    setScheduleInputs((prev) => {
      const next = { ...prev };
      variants.forEach((variant) => {
        if (next[variant.variant_id] === undefined && variant.post_publication_scheduled_at) {
          next[variant.variant_id] = toLocalInputValue(variant.post_publication_scheduled_at);
        }
      });
      return next;
    });
  }, [variants]);

  const getScheduleInputValue = useCallback(
    (variant: DraftVariantRender) => {
      const stored = scheduleInputs[variant.variant_id];
      if (stored !== undefined) {
        return stored;
      }
      return toLocalInputValue(variant.post_publication_scheduled_at);
    },
    [scheduleInputs],
  );

  const setScheduleInputValue = useCallback((variantId: number, value: string) => {
    setScheduleInputs((prev) => ({ ...prev, [variantId]: value }));
  }, []);

  const openScheduleDialog = useCallback((variant: DraftVariantRender) => {
    setSelectedVariantForSchedule(variant);
    // Set default schedule value if not already set
    if (!scheduleInputs[variant.variant_id]) {
      setScheduleInputValue(variant.variant_id, defaultScheduleLocal());
    }
    setScheduleDialogOpen(true);
  }, [scheduleInputs, setScheduleInputValue]);

  const closeScheduleDialog = useCallback(() => {
    setScheduleDialogOpen(false);
    setSelectedVariantForSchedule(null);
  }, []);

  const invalidateVariantQueries = useCallback(
    async (platform: string) => {
      if (!hasDraftContext) {
        return;
      }
      const baseKey = [`/api/bff/drafts/${draftId}/variants`];
      const platformKey = [`/api/bff/drafts/${draftId}/variants/${platform}`];
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: baseKey }),
        queryClient.invalidateQueries({ queryKey: platformKey }),
      ]);
      await refetch();
    },
    [hasDraftContext, draftId, queryClient, refetch],
  );

  const handleScheduleDialogSave = useCallback(async () => {
    if (!selectedVariantForSchedule) return;

    const scheduleLocal = getScheduleInputValue(selectedVariantForSchedule);
    if (!scheduleLocal) {
      toast.error("Select a scheduled time.");
      return;
    }

    const platformKind = (ensurePlatformKind(selectedVariantForSchedule.platform) ?? selectedVariantForSchedule.platform) as PlatformKind;
    const scheduledISO = fromLocalInputValue(scheduleLocal);
    const payload: DraftVariantReadyCommand = {
      draft_id: draftId ?? null,
      platform: platformKind,
      ready: true,
      scheduled_at: scheduledISO,
    };

    try {
      const result = await toggleReadyMutation.mutateAsync({
        draftId: draftId ?? null,
        platform: platformKind,
        data: payload,
      });
      const scheduled = (result as PostPublicationOut | null)?.scheduled_at ?? scheduledISO;
      setScheduleInputValue(selectedVariantForSchedule.variant_id, toLocalInputValue(scheduled));
      toast.success("Post scheduled successfully.");
      await invalidateVariantQueries(selectedVariantForSchedule.platform);
      closeScheduleDialog();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [selectedVariantForSchedule, getScheduleInputValue, draftId, toggleReadyMutation, setScheduleInputValue, invalidateVariantQueries, closeScheduleDialog]);

  const handleToggleChange = useCallback(
    async (variant: DraftVariantRender, nextChecked: boolean) => {
      if (!hasDraftContext) {
        toast.error("Draft context is required to schedule publishing.");
        return;
      }
      if (toggleReadyMutation.isPending) {
        return;
      }

      const platformKind = (ensurePlatformKind(variant.platform) ?? variant.platform) as PlatformKind;
      const payload: DraftVariantReadyCommand = {
        draft_id: draftId ?? null,
        platform: platformKind,
        ready: nextChecked,
        scheduled_at: null,
      };

      if (nextChecked) {
        let scheduleLocal = getScheduleInputValue(variant);
        if (!scheduleLocal) {
          scheduleLocal = defaultScheduleLocal();
          setScheduleInputValue(variant.variant_id, scheduleLocal);
        }
        payload.scheduled_at = fromLocalInputValue(scheduleLocal);
      }

      try {
        const result = await toggleReadyMutation.mutateAsync({
          draftId: draftId ?? null,
          platform: platformKind,
          data: payload,
        });

        if (nextChecked) {
          const scheduled = (result as PostPublicationOut | null)?.scheduled_at ?? payload.scheduled_at ?? null;
          setScheduleInputValue(variant.variant_id, toLocalInputValue(scheduled));
          toast.success("Variant marked ready for post.");
        } else {
          toast.success("Variant marked as not ready for post.");
        }

        await invalidateVariantQueries(variant.platform);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [draftId, getScheduleInputValue, hasDraftContext, invalidateVariantQueries, setScheduleInputValue, toggleReadyMutation],
  );

  const handleScheduleSave = useCallback(
    async (variant: DraftVariantRender) => {
      if (!hasDraftContext) {
        toast.error("Draft context is required to schedule publishing.");
        return;
      }
      if (toggleReadyMutation.isPending) {
        return;
      }

      const publicationStatus = variant.post_publication_status?.toLowerCase() ?? "";
      if (!READY_ACTIVE_STATUSES.has(publicationStatus)) {
        toast.error("Enable ready for post before scheduling.");
        return;
      }

      const scheduleLocal = getScheduleInputValue(variant);
      if (!scheduleLocal) {
        toast.error("Select a scheduled time.");
        return;
      }

      const platformKind = (ensurePlatformKind(variant.platform) ?? variant.platform) as PlatformKind;
      const scheduledISO = fromLocalInputValue(scheduleLocal);
      const payload: DraftVariantReadyCommand = {
        draft_id: draftId ?? null,
        platform: platformKind,
        ready: true,
        scheduled_at: scheduledISO,
      };

      try {
        const result = await toggleReadyMutation.mutateAsync({
          draftId: draftId ?? null,
          platform: platformKind,
          data: payload,
        });
        const scheduled = (result as PostPublicationOut | null)?.scheduled_at ?? scheduledISO;
        setScheduleInputValue(variant.variant_id, toLocalInputValue(scheduled));
        toast.success("Schedule updated.");
        await invalidateVariantQueries(variant.platform);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [draftId, getScheduleInputValue, hasDraftContext, invalidateVariantQueries, setScheduleInputValue, toggleReadyMutation],
  );

  // 컴파일 중인 variants가 있으면 자동 갱신
  const hasPendingVariants = variants.some(variant => variant.status.toLowerCase() === 'pending');

  useEffect(() => {
    if (!hasPendingVariants) return;

    const interval = setInterval(() => {
      refetch();
    }, 2000);

    return () => clearInterval(interval);
  }, [hasPendingVariants, refetch]);

  if (isLoading && !providedVariants) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <CardTitle className="text-sm font-medium">Loading variants…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isError && !providedVariants) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-destructive">Failed to load variants</CardTitle>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Unable to retrieve draft variants for this draft.
        </CardContent>
      </Card>
    );
  }

  if (!variants.length) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            No variants generated yet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create or compile variants to preview platform outputs.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {compact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {variants.map((variant) => {
            const kind = ensurePlatformKind(variant.platform);
            const platformMeta = kind ? platformPresentation[kind] : null;
            const warningCount = countListItems(variant.warnings);
            const errorCount = countListItems(variant.errors);
            const hasIssues = warningCount > 0 || errorCount > 0;
            const publicationStatus = variant.post_publication_status?.toLowerCase() ?? "";
            const isLocked = READY_LOCKED_STATUSES.has(publicationStatus);
            const isActiveReady = READY_ACTIVE_STATUSES.has(publicationStatus);
            return (
              <div
                key={variant.variant_id}
                className={cn(
                  "text-left",
                  "rounded-lg border bg-card transition shadow-sm p-3",
                  "hover:border-primary/40 hover:shadow-md",
                  platformMeta?.accentClass ?? "border-border/70",
                  onSelect ? "cursor-pointer" : "cursor-default"
                )}
                onClick={() => onSelect?.(variant)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {platformMeta ? (
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", platformMeta.badgeClass)}>
                        {platformMeta.label}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                        {variant.platform}
                      </span>
                    )}
                  </div>
                  {getStatusIcon(variant.status)}
                </div>

                {variant.rendered_caption && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{variant.rendered_caption}</p>
                )}

                <div className="text-xs text-muted-foreground">
                  {mediaSummary(variant.rendered_blocks ?? undefined)}
                </div>

                {hasDraftContext && (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {isActiveReady ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`ready-${variant.variant_id}-compact`}
                            checked={true}
                            disabled={!hasDraftContext || isLocked || isMutating}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={(value) => {
                              if (value === 'indeterminate') return;
                              void handleToggleChange(variant, value === true);
                            }}
                          />
                          <span className="text-xs font-medium text-green-600">Ready for post</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasDraftContext || isLocked || isMutating}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isLocked && !isMutating) {
                              openScheduleDialog(variant);
                            }
                          }}
                          className="text-xs h-7"
                        >
                          Schedule Post
                        </Button>
                      )}
                    </div>
                    {isActiveReady && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isLocked && !isMutating) {
                            openScheduleDialog(variant);
                          }
                        }}
                        disabled={isLocked || isMutating}
                      >
                        {formatScheduleDisplay(variant.post_publication_scheduled_at)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {variants.map((variant) => {
            const kind = ensurePlatformKind(variant.platform);
            const platformMeta = kind ? platformPresentation[kind] : null;
            const warningCount = countListItems(variant.warnings);
            const errorCount = countListItems(variant.errors);
            const hasIssues = warningCount > 0 || errorCount > 0;
            const publicationStatus = variant.post_publication_status?.toLowerCase() ?? "";
            const isLocked = READY_LOCKED_STATUSES.has(publicationStatus);
            const isActiveReady = READY_ACTIVE_STATUSES.has(publicationStatus);
            return (
          <div
            key={variant.variant_id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={() => onSelect?.(variant)}
            onKeyDown={(event) => {
              if (!onSelect) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(variant);
              }
            }}
            className={cn(
              "w-full text-left",
              "rounded-lg border bg-card transition shadow-sm",
              onSelect ? "hover:border-primary/40 hover:shadow-md" : undefined,
              platformMeta?.accentClass ?? "border-border/70",
              onSelect ? "cursor-pointer" : "cursor-default"
            )}
          >
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {platformMeta ? (
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", platformMeta.badgeClass)}>
                      {platformMeta.label}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                      {variant.platform}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatCompiledAt(variant.compiled_at)}
                  </div>
                  {getStatusIcon(variant.status)}
                </div>
              </div>

              {variant.rendered_caption && (
                <p className="text-sm text-muted-foreground line-clamp-2">{variant.rendered_caption}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{mediaSummary(variant.rendered_blocks ?? undefined)}</span>
                {variant.metrics && (
                  <span>{Object.keys(variant.metrics).length} metric fields</span>
                )}
                <span>Compiler v{variant.compiler_version}</span>
                <span>IR rev {variant.ir_revision_compiled ?? "-"}</span>
              </div>

              {hasIssues ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {errorCount} error{errorCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
                      <AlertTriangle className="h-3 w-3" />
                      {warningCount} warning{warningCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              ) : variant.status.toLowerCase() === 'valid' ? (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready for review
                </div>
              ) : null}

              <div className="border-t pt-3 mt-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isActiveReady ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`ready-${variant.variant_id}`}
                          checked={true}
                          disabled={!hasDraftContext || isLocked || isMutating}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(value) => {
                            if (value === 'indeterminate') return;
                            void handleToggleChange(variant, value === true);
                          }}
                        />
                        <span className="text-sm font-medium text-green-600">Ready for post</span>
                        {publicationStatus && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {publicationStatus}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasDraftContext || isLocked || isMutating}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isLocked && !isMutating) {
                            openScheduleDialog(variant);
                          }
                        }}
                      >
                        Schedule Post
                      </Button>
                    )}
                  </div>
                  {isActiveReady && (
                    <button
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!isLocked && !isMutating) {
                          openScheduleDialog(variant);
                        }
                      }}
                      disabled={isLocked || isMutating}
                    >
                      {formatScheduleDisplay(variant.post_publication_scheduled_at)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
        </div>
      )}

      {selectedVariantForSchedule && scheduleDialogOpen && (
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          variant={selectedVariantForSchedule!}
          currentSchedule={getScheduleInputValue(selectedVariantForSchedule!)}
          onScheduleChange={(value) => setScheduleInputValue(selectedVariantForSchedule!.variant_id, value)}
          onSave={handleScheduleDialogSave}
          isSaving={isMutating}
          platformLabel={platformPresentation[ensurePlatformKind(selectedVariantForSchedule!.platform) ?? PlatformKind.instagram]?.label ?? selectedVariantForSchedule!.platform}
        />
      )}
    </>
  );
}

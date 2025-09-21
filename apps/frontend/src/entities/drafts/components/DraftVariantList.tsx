import { useMemo, useEffect } from "react";
import { AlertTriangle, Loader2, RefreshCw, FileWarning, CheckCircle2, Clock, X, CheckCircle } from "lucide-react";

import { useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DraftVariantRender,
  RenderedVariantBlocks,
} from "@/lib/api/generated";
import {
  ensurePlatformKind,
  formatCompiledAt,
  platformPresentation,
  countListItems,
} from "../draftVariant";

const STATUS_BADGES: Record<string, string> = {
  valid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-900",
  rendered: "bg-indigo-100 text-indigo-900",
  invalid: "bg-rose-100 text-rose-900",
};


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
  const { data, isLoading, isError, refetch } = useBffDraftsListVariantsApiBffDraftsDraftIdVariantsGet(draftId || 0, {
    query: {
      enabled: draftId !== undefined && draftId !== null && !providedVariants,
    },
  });

  const variants = useMemo(() => providedVariants ?? data ?? [], [providedVariants, data]);

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

  if (compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {variants.map((variant) => {
          const kind = ensurePlatformKind(variant.platform);
          const platformMeta = kind ? platformPresentation[kind] : null;
          const warningCount = countListItems(variant.warnings);
          const errorCount = countListItems(variant.errors);
          const hasIssues = warningCount > 0 || errorCount > 0;
          return (
            <button
              key={variant.variant_id}
              onClick={() => onSelect?.(variant)}
              className={cn(
                "text-left",
                "rounded-lg border bg-card transition shadow-sm p-3",
                "hover:border-primary/40 hover:shadow-md",
                platformMeta?.accentClass ?? "border-border/70",
                onSelect ? "cursor-pointer" : "cursor-default"
              )}
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
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variants.map((variant) => {
        const kind = ensurePlatformKind(variant.platform);
        const platformMeta = kind ? platformPresentation[kind] : null;
        const warningCount = countListItems(variant.warnings);
        const errorCount = countListItems(variant.errors);
        const hasIssues = warningCount > 0 || errorCount > 0;
        return (
          <button
            key={variant.variant_id}
            onClick={() => onSelect?.(variant)}
            className={cn(
              "w-full text-left",
              "rounded-lg border bg-card transition shadow-sm",
              "hover:border-primary/40 hover:shadow-md",
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
            </div>
          </button>
        );
      })}
    </div>
  );
}

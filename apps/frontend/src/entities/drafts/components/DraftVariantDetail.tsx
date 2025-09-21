import { useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, ImageIcon, Expand } from "lucide-react";

import { useBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DraftVariantRenderDetail,
  RenderedMediaItem,
} from "@/lib/api/generated";
import {
  ensurePlatformKind,
  formatCompiledAt,
  platformPresentation,
  countListItems,
} from "../draftVariant";

function formatMetricKey(key: string): string {
  const keyMappings: Record<string, string> = {
    estimated_reading_time_seconds: "Reading Time (s)",
    estimated_word_count: "Word Count",
    estimated_character_count: "Character Count",
    estimated_paragraph_count: "Paragraphs",
    readability_score: "Readability",
    sentiment_score: "Sentiment",
    engagement_score: "Engagement",
    virality_score: "Virality",
    seo_score: "SEO Score",
    content_quality_score: "Quality",
  };

  return keyMappings[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function DraftVariantDetail({
  draftId,
  platform,
}: {
  draftId: number;
  platform: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, isError, refetch } = useBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGet(draftId, platform as any, {
    query: {
      enabled: Boolean(draftId && platform),
    },
  });

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <CardTitle className="text-sm font-medium">Loading variant…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="flex justify-between items-center">
          <CardTitle className="text-sm font-semibold text-destructive">Unable to load variant</CardTitle>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          Try compiling the draft again.
        </CardContent>
      </Card>
    );
  }

  const kind = ensurePlatformKind(data.platform);
  const platformMeta = kind ? platformPresentation[kind] : null;
  const warningCount = countListItems(data.warnings);
  const errorCount = countListItems(data.errors);
  const mediaItems = data.rendered_blocks?.media ?? [];

  const renderVariantContent = () => (
    <>
      {data.rendered_caption && (
        <div>
          <h4 className="text-sm font-medium mb-1">Caption</h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85 break-words overflow-wrap-anywhere">
            {data.rendered_caption}
          </p>
        </div>
      )}

      {mediaItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Media</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {mediaItems.map((item: RenderedMediaItem, index) => (
              <div key={`${item.url}-${index}`} className="rounded border bg-muted/20 p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="uppercase tracking-wide">{item.type}</span>
                  {item.ratio && <span>• {item.ratio}</span>}
                </div>
                <p className="break-all text-xs text-muted-foreground/80">{item.url}</p>
                {item.caption && (
                  <p className="mt-2 text-xs italic text-muted-foreground">{item.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Boolean(data.metrics && Object.keys(data.metrics ?? {}).length) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Metrics Snapshot</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(data.metrics ?? {}).map(([key, value]) => (
              <div key={key} className="rounded bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">{formatMetricKey(key)}</span>: {String(value)}
              </div>
            ))}
          </div>
        </div>
      )}

      {(warningCount > 0 || errorCount > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Validation</h4>
          {errorCount > 0 && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <p className="mb-2 font-semibold uppercase tracking-wide">Errors</p>
              <ul className="list-disc space-y-1 pl-4">
                {(data.errors ?? []).map((err, idx) => (
                  <li key={`err-${idx}`} className="break-words overflow-wrap-anywhere">{err}</li>
                ))}
              </ul>
            </div>
          )}
          {warningCount > 0 && (
            <div className="rounded border border-amber-300 bg-amber-100/40 p-3 text-xs text-amber-900">
              <p className="mb-2 font-semibold uppercase tracking-wide">Warnings</p>
              <ul className="list-disc space-y-1 pl-4">
                {(data.warnings ?? []).map((warn, idx) => (
                  <li key={`warn-${idx}`} className="break-words overflow-wrap-anywhere">{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <Card className={cn("shadow-sm", platformMeta?.accentClass ?? "border-border/70")}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {platformMeta ? (
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", platformMeta.badgeClass)}>
                {platformMeta.label}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                {data.platform}
              </span>
            )}
            <Badge variant="outline" className="capitalize text-xs">
              {data.status.toLowerCase()}
            </Badge>
          </div>
          <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Expand className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Variant Detail</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {renderVariantContent()}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardTitle className="text-base font-semibold">Variant Preview</CardTitle>
        <p className="text-xs text-muted-foreground">Compiled {formatCompiledAt(data.compiled_at)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderVariantContent()}
      </CardContent>
    </Card>
  );
}

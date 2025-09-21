import { useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { useBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  formatOptionValue,
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

function renderOptionValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">{String(value)}</span>;
  }

  if (typeof value === 'string') {
    return <span className="text-green-600">"{value}"</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-blue-600">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-600' : 'text-red-600'}>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }

    if (value.length <= 3) {
      return (
        <span className="text-muted-foreground">
          [{value.map(item => formatOptionValue(item, 20)).join(', ')}]
        </span>
      );
    }

    return (
      <div className="space-y-1">
        <span className="text-muted-foreground">Array ({value.length} items)</span>
        <div className="pl-2 space-y-1 max-h-24 overflow-y-auto">
          {value.slice(0, 3).map((item, index) => (
            <div key={index} className="text-xs">
              <span className="text-muted-foreground">[{index}]:</span>{' '}
              {renderOptionValue(item)}
            </div>
          ))}
          {value.length > 3 && (
            <div className="text-xs text-muted-foreground italic">
              ... and {value.length - 3} more items
            </div>
          )}
        </div>
      </div>
    );
  }

  if (typeof value === 'object') {
    try {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return <span className="text-muted-foreground">{"{}"}</span>;
      }

      if (entries.length <= 2) {
        const formatted = entries.map(([k, v]) => `${k}: ${formatOptionValue(v, 15)}`).join(', ');
        return <span className="text-muted-foreground">{"{"}{formatted}{"}"}</span>;
      }

      return (
        <div className="space-y-1">
          <span className="text-muted-foreground">Object ({entries.length} properties)</span>
          <div className="pl-2 space-y-1 max-h-24 overflow-y-auto">
            {entries.slice(0, 3).map(([key, val]) => (
              <div key={key} className="text-xs">
                <span className="text-purple-600 font-medium">{key}</span>:{' '}
                {renderOptionValue(val)}
              </div>
            ))}
            {entries.length > 3 && (
              <div className="text-xs text-muted-foreground italic">
                ... and {entries.length - 3} more properties
              </div>
            )}
          </div>
        </div>
      );
    } catch {
      return <span className="text-muted-foreground">[Complex Object]</span>;
    }
  }

  return <span>{String(value)}</span>;
}

export function DraftVariantDetail({
  draftId,
  platform,
}: {
  draftId: number;
  platform: string;
}) {
  const [mediaStartIndex, setMediaStartIndex] = useState(0);
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

  // Media navigation
  const maxVisibleMedia = 3;
  const visibleMediaItems = mediaItems.slice(mediaStartIndex, mediaStartIndex + maxVisibleMedia);
  const canGoPrev = mediaStartIndex > 0;
  const canGoNext = mediaStartIndex + maxVisibleMedia < mediaItems.length;

  const goToPrevMedia = () => {
    setMediaStartIndex(Math.max(0, mediaStartIndex - maxVisibleMedia));
  };

  const goToNextMedia = () => {
    setMediaStartIndex(Math.min(mediaItems.length - maxVisibleMedia, mediaStartIndex + maxVisibleMedia));
  };

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
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Media ({mediaItems.length})</h4>
            {mediaItems.length > maxVisibleMedia && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevMedia}
                  disabled={!canGoPrev}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {mediaStartIndex + 1}-{Math.min(mediaStartIndex + maxVisibleMedia, mediaItems.length)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMedia}
                  disabled={!canGoNext}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {visibleMediaItems.map((item: RenderedMediaItem, index) => {
              const globalIndex = mediaStartIndex + index;
              return (
                <div key={`${item.url}-${globalIndex}`} className="flex-1 min-w-0">
                  <div className="aspect-square bg-muted/20 rounded border overflow-hidden mb-2">
                    {item.type === 'image' && item.url ? (
                      <img
                        src={item.url}
                        alt={item.alt || `Media ${globalIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center text-muted-foreground text-xs ${item.type === 'image' && item.url ? 'hidden' : ''}`}>
                      <div className="text-center">
                        <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                        <div>{item.type?.toUpperCase() || 'MEDIA'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide font-medium">{item.type}</span>
                      {item.ratio && <span>• {item.ratio}</span>}
                    </div>
                    <p className="break-all text-xs text-muted-foreground/80 leading-tight" title={item.url || undefined}>
                      {item.url && item.url.length > 40 ? `${item.url.slice(0, 40)}...` : (item.url || 'No URL')}
                    </p>
                    {item.caption && (
                      <p className="text-xs italic text-muted-foreground leading-tight" title={item.caption}>
                        {item.caption.length > 60 ? `${item.caption.slice(0, 60)}...` : item.caption}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(Boolean(data.rendered_blocks?.options) && Object.keys(data.rendered_blocks?.options ?? {}).length) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Options</h4>
          <div className="space-y-2">
            {Object.entries(data.rendered_blocks?.options ?? {}).map(([key, value]) => (
              <div key={key} className="rounded bg-muted/30 px-3 py-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-foreground/80 min-w-0 flex-shrink-0">{key}:</span>
                  <div className="min-w-0 flex-1">
                    {renderOptionValue(value)}
                  </div>
                </div>
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
        <CardTitle className="text-base font-semibold">Platform Variant Detail</CardTitle>
        <p className="text-xs text-muted-foreground">Compiled {formatCompiledAt(data.compiled_at)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderVariantContent()}
      </CardContent>
    </Card>
  );
}

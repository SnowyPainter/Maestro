import { useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { useBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGet, PlatformKind, RenderedMediaItem, DraftVariantRenderDetail } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ensurePlatformKind,
  formatCompiledAt,
  platformPresentation,
  countListItems,
  formatOptionValue,
} from "../draftVariant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstagramPreview } from "./preview/Instagram";
import { ThreadsPreview } from "./preview/Threads";

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
    char_count: "Character Count",
    line_breaks: "Line Breaks",
    media_count: "Media Items",
    hashtag_count: "Hashtag Count",
    thread_length: "Thread Length",
    style_alignment: "Style Alignment Score",
  };

  return keyMappings[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatMetricValue(value: unknown): string {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return value.toFixed(2);
  }
  return String(value);
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
        return <span className="text-muted-foreground">{'{}'}</span>;
      }

      if (entries.length <= 2) {
        const formatted = entries.map(([k, v]) => `${k}: ${formatOptionValue(v, 15)}`).join(', ');
        return <span className="text-muted-foreground">{'{'}${formatted}{'}'}</span>;
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
  variantData,
}: {
  draftId?: number;
  platform?: string;
  variantData?: DraftVariantRenderDetail;
}) {
  const [mediaStartIndex, setMediaStartIndex] = useState(0);

  const requestedPlatform = platform ? ensurePlatformKind(platform) : undefined;
  const normalizedPlatform = requestedPlatform ?? PlatformKind.instagram;
  const { data, isLoading, isError, refetch } = useBffDraftsReadVariantApiBffDraftsDraftIdVariantsPlatformGet(
    draftId!,
    normalizedPlatform,
    {
      query: {
        enabled: Boolean(draftId && requestedPlatform && !variantData),
      },
    }
  );

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

  const displayData = variantData || data;

  if (isError || !displayData) {
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
  const kind = ensurePlatformKind(displayData.platform);
  const platformMeta = kind ? platformPresentation[kind] : null;
  const warningCount = countListItems(displayData.warnings);
  const errorCount = countListItems(displayData.errors);
  const mediaItems = displayData.rendered_blocks?.media ?? [];
  const options = displayData.rendered_blocks?.options as Record<string, unknown> | undefined;
  const policyOptions = options?.policy as Record<string, unknown> | undefined;
  const compileOptions = options?.compile as Record<string, unknown> | undefined;
  const personaAdjustments = compileOptions?.persona as Record<string, unknown> | undefined;
  const personaHashtags = personaAdjustments?.hashtags as {
    appended?: string[];
    skipped?: string[];
  } | undefined;
  const personaReplace = personaAdjustments?.replace_map as {
    applied?: Array<{ source: string; target: string }>;
    skipped?: string[];
  } | undefined;
  const personaLinkPolicy = personaAdjustments?.link_policy as {
    link_in_bio?: string;
    utm?: Record<string, string>;
    inline_link?: {
      strategy?: string;
      replacement_text?: string;
      processed_urls?: string[];
    };
    tracking_links?: {
      enabled?: boolean;
      issued_count?: number;
      warnings?: string[];
      links?: Array<{
        link_id?: number;
        token?: string;
        original_url?: string;
        public_url?: string;
      }>;
    };
  } | undefined;
  const personaMediaPrefs = personaAdjustments?.media_prefs as {
    preferred_ratio?: string;
    allow_carousel?: boolean;
  } | undefined;
  const personaMisc = personaAdjustments
    ? Object.entries(personaAdjustments).filter(([
        key,
      ]) => ![
        "hashtags",
        "replace_map",
        "media_prefs",
        "link_policy",
      ].includes(key))
    : [];
  const compileMetaEntries = compileOptions
    ? Object.entries(compileOptions).filter(([key]) => key !== "persona")
    : [];
  const extraOptionEntries = options
    ? Object.entries(options).filter(([key]) => key !== "policy" && key !== "compile")
    : [];
  const otherBlockEntries = Object.entries(displayData.rendered_blocks ?? {}).filter(
    ([key]) => !["media", "options", "metrics"].includes(key)
  );

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

  const renderVariantContent = () => {
    const renderPreview = () => {
      const platform = ensurePlatformKind(displayData.platform);
      const caption = displayData.rendered_caption || '';
      const media = mediaItems || [];

      switch (platform) {
        case PlatformKind.instagram:
          return <InstagramPreview caption={caption} mediaItems={media} size="sm" />;
        case PlatformKind.threads:
          return <ThreadsPreview caption={caption} mediaItems={media} size="sm" />;
        default:
          return (
            <div className="space-y-4">
              {displayData.rendered_caption && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Caption</h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85 break-words overflow-wrap-anywhere">
                    {displayData.rendered_caption}
                  </p>
                </div>
              )}
              {mediaItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Media ({mediaItems.length})</h4>
                  <div className="flex gap-3 overflow-x-auto">
                    {mediaItems.map((item: RenderedMediaItem, index) => (
                      <div key={`${item.url}-${index}`} className="flex-shrink-0 w-40">
                        <div className="aspect-square bg-muted/20 rounded border overflow-hidden mb-2">
                          {item.type === 'image' && item.url ? (
                            <img
                              src={item.url}
                              alt={item.alt || `Media ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <p className="break-all text-xs text-muted-foreground/80 leading-tight truncate">
                          {item.url || 'No URL'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
      }
    };

    return (
      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          {renderPreview()}
        </TabsContent>

        <TabsContent value="analysis" className="mt-4 space-y-4">
          {Boolean(displayData.metrics && Object.keys(displayData.metrics ?? {}).length) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Metrics Snapshot</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(displayData.metrics ?? {}).map(([key, value]) => (
                  <div key={key} className="rounded bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{formatMetricKey(key)}</span>: {formatMetricValue(value)}
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
                    {(displayData.errors ?? []).map((err, idx) => (
                      <li key={`err-${idx}`} className="break-words overflow-wrap-anywhere">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {warningCount > 0 && (
                <div className="rounded border border-amber-300 bg-amber-100/40 p-3 text-xs text-amber-900">
                  <p className="mb-2 font-semibold uppercase tracking-wide">Warnings</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {(displayData.warnings ?? []).map((warn, idx) => (
                      <li key={`warn-${idx}`} className="break-words overflow-wrap-anywhere">{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="persona" className="mt-4 space-y-4">
          {personaAdjustments && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Persona Adjustments</h4>
              {personaHashtags?.appended?.length ? (
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground uppercase tracking-wide">Appended Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {personaHashtags.appended.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {personaHashtags?.skipped?.length ? (
                <p className="text-xs text-muted-foreground">
                  Skipped default hashtags: {personaHashtags.skipped.join(', ')}
                </p>
              ) : null}
              {personaReplace?.applied?.length ? (
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground uppercase tracking-wide">Replace Map</p>
                  <div className="space-y-1">
                    {personaReplace.applied.map((pair, index) => (
                      <div key={`${pair.source}-${index}`} className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{pair.source}</code>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm">{pair.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {personaReplace?.skipped?.length ? (
                <p className="text-xs text-muted-foreground">
                  Placeholders not found: {personaReplace.skipped.join(', ')}
                </p>
              ) : null}
              {personaLinkPolicy ? (
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground uppercase tracking-wide">Link Policy</p>
                  {personaLinkPolicy.link_in_bio ? (
                    <p className="flex items-center gap-2">
                      <span className="font-semibold text-foreground/80">Link In Bio:</span>
                      <span>{personaLinkPolicy.link_in_bio}</span>
                    </p>
                  ) : null}
                  {personaLinkPolicy.utm && Object.keys(personaLinkPolicy.utm).length ? (
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground/80">UTM Params</span>
                      <div className="grid gap-1">
                        {Object.entries(personaLinkPolicy.utm).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key}</code>
                            <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {personaLinkPolicy.inline_link ? (
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground/80">Inline Links</span>
                      <p className="text-muted-foreground">
                        Strategy: {personaLinkPolicy.inline_link.strategy || 'keep'}
                      </p>
                      {personaLinkPolicy.inline_link.replacement_text ? (
                        <p className="text-muted-foreground">
                          Replacement: "{personaLinkPolicy.inline_link.replacement_text}"
                        </p>
                      ) : null}
                      {personaLinkPolicy.inline_link.processed_urls?.length ? (
                        <div className="space-y-1">
                          <span className="text-muted-foreground">Processed URLs:</span>
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {personaLinkPolicy.inline_link.processed_urls.map((url) => (
                              <li key={url} className="break-all">{url}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {personaLinkPolicy.tracking_links ? (
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground/80">Tracking Links</span>
                      <p className="text-muted-foreground">
                        Status: {personaLinkPolicy.tracking_links.enabled ? 'Enabled' : 'Disabled'} • Issued{" "}
                        {personaLinkPolicy.tracking_links.issued_count ?? 0}
                      </p>
                      {personaLinkPolicy.tracking_links.warnings?.length ? (
                        <ul className="text-xs text-amber-600 list-disc pl-4">
                          {personaLinkPolicy.tracking_links.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                      {personaLinkPolicy.tracking_links.links?.length ? (
                        <div className="space-y-1">
                          <span className="text-muted-foreground">Issued URLs:</span>
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {personaLinkPolicy.tracking_links.links.map((link) => (
                              <li key={link.token ?? link.public_url} className="break-all space-y-0.5">
                                <div>
                                  <span className="font-medium">Public:</span>{" "}
                                  {link.public_url ? (
                                    <a href={link.public_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                      {link.public_url}
                                    </a>
                                  ) : (
                                    <span>{link.token}</span>
                                  )}
                                </div>
                                {link.original_url ? (
                                  <div className="text-[11px] text-muted-foreground">
                                    → {link.original_url}
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {personaMediaPrefs?.preferred_ratio ? (
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground uppercase tracking-wide">Preferred Image Ratio</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{personaMediaPrefs.preferred_ratio}</Badge>
                    {mediaItems.some((item) => item.type === 'image' && item.ratio && item.ratio !== personaMediaPrefs.preferred_ratio) ? (
                      <span className="text-amber-600">Check media crops</span>
                    ) : (
                      <span className="text-green-600">All matching</span>
                    )}
                  </div>
                </div>
              ) : null}
              {personaMediaPrefs?.allow_carousel !== undefined ? (
                <p className="text-xs text-muted-foreground">Carousel allowed: {personaMediaPrefs.allow_carousel ? 'Yes' : 'No'}</p>
              ) : null}
              {personaMisc.length ? (
                <div className="space-y-1 text-xs">
                  {personaMisc.map(([key, value]) => (
                    <div key={key} className="rounded bg-muted/30 px-2 py-1">
                      <span className="font-semibold mr-1">{key}:</span>
                      {renderOptionValue(value)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
          {policyOptions && Object.keys(policyOptions).length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Platform Policy</h4>
              <div className="grid gap-1 text-xs">
                {Object.entries(policyOptions).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="uppercase tracking-wide text-muted-foreground min-w-[110px]">{key}</span>
                    <div>{renderOptionValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {compileMetaEntries.length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Compile Insights</h4>
              <div className="space-y-1 text-xs">
                {compileMetaEntries.map(([key, value]) => (
                  <div key={key} className="rounded bg-muted/30 px-3 py-2">
                    <span className="font-semibold text-foreground/80 mr-2">{key}</span>
                    {renderOptionValue(value)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {extraOptionEntries.length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Options</h4>
              <div className="space-y-2">
                {extraOptionEntries.map(([key, value]) => (
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
          ) : null}

          {otherBlockEntries.length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Additional Blocks</h4>
              <div className="space-y-2">
                {otherBlockEntries.map(([key, value]) => (
                  <div key={key} className="rounded bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground/80 mb-1 uppercase tracking-wide">{key}</p>
                    <pre className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    );
  };

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
              {displayData.platform}
            </span>
          )}
          <Badge variant="outline" className="capitalize text-xs">
            {displayData.status.toLowerCase()}
          </Badge>
        </div>
        <CardTitle className="text-base font-semibold">Platform Variant Detail</CardTitle>
        <p className="text-xs text-muted-foreground">Compiled {formatCompiledAt(displayData.compiled_at)}</p>
      </CardHeader>
      <CardContent>
        {renderVariantContent()}
      </CardContent>
    </Card>
  );
}

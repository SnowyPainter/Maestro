import { useState } from "react";
import { useBffPlaybookGetPlaybookDetailApiBffPlaybooksDetailGet } from "@/lib/api/generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Brain, TrendingUp, Target, MessageSquare, Hash, Clock, Zap } from "lucide-react";

// Type guards for safer type checking
const isValidPersonaSnapshot = (obj: unknown): obj is {
  name?: string;
  language?: string;
  tone?: string;
  pillars?: string[];
  default_hashtags?: string[];
  bio?: string;
} => {
  return obj !== null && typeof obj === 'object';
};

const isValidTrendSnapshot = (obj: unknown): obj is {
  country?: string;
  source?: string;
  retrieved_at?: string;
  items?: Array<{
    title?: string;
    name?: string;
    rank?: number;
    description?: string;
  }>;
} => {
  return obj !== null && typeof obj === 'object';
};

const isValidKpiSnapshot = (obj: unknown): obj is Record<string, unknown> => {
  return obj !== null && typeof obj === 'object';
};

const isValidLlmData = (obj: unknown): obj is {
  prompt?: string;
  text?: string;
} => {
  return obj !== null && typeof obj === 'object';
};

export function PlaybookDetail({ playbookId, onDelete }: { playbookId: number, onDelete: () => void }) {
  const [displayedLogCount, setDisplayedLogCount] = useState(20);
  const { data: playbookDetail, isLoading, isError } = useBffPlaybookGetPlaybookDetailApiBffPlaybooksDetailGet({
    playbook_id: playbookId,
    include_logs: true
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !playbookDetail) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load playbook details.</p>
        </CardContent>
      </Card>
    );
  }

  const pb = playbookDetail.playbook;
  const logs = playbookDetail.logs || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Playbook {pb.id}
        </CardTitle>
        <CardDescription>
          {pb.campaign_name} × {pb.persona_name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-primary mb-1">Campaign</h4>
              <p className="font-medium">{pb.campaign_name}</p>
              {pb.campaign_description && (
                <p className="text-muted-foreground text-xs">{pb.campaign_description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">ID: {pb.campaign_id}</p>
            </div>
            <div>
              <h4 className="font-medium text-secondary mb-1">Persona</h4>
              <p className="font-medium">{pb.persona_name}</p>
              {pb.persona_bio && (
                <p className="text-muted-foreground text-xs">{pb.persona_bio}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">ID: {pb.persona_id}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Event:</span>
              <Badge variant="outline">{pb.last_event || "None"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="text-xs">{new Date(pb.last_updated).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span className="text-xs">{new Date(pb.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Rich Content Tabs */}
        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="insights" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              Logs ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="persona" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Persona
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="kpis" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              KPIs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-4">
            {pb.aggregate_kpi && Object.keys(pb.aggregate_kpi).length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Aggregate KPIs
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(pb.aggregate_kpi).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(pb.best_time_window || pb.best_tone || pb.top_hashtags) && (
              <div>
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Optimization Insights
                </h4>
                <div className="space-y-3">
                  {pb.best_time_window && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Best Time Window</span>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {pb.best_time_window}
                      </Badge>
                    </div>
                  )}
                  {pb.best_tone && (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Best Tone</span>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {pb.best_tone}
                      </Badge>
                    </div>
                  )}
                  {pb.top_hashtags && pb.top_hashtags.length > 0 && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Top Hashtags</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pb.top_hashtags.map((hashtag, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-purple-100 text-purple-800">
                            {hashtag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Playbook Event Logs
              </h4>
              {logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No logs available</p>
                  <p className="text-xs">Playbook activity logs will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(() => {
                    // Sort logs by timestamp (newest first) and compress consecutive duplicates
                    const sortedLogs = [...logs].sort((a, b) =>
                      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    const compressedLogs: Array<{
                      log: typeof logs[0];
                      count: number;
                      ids: number[];
                    }> = [];

                    for (const log of sortedLogs) {
                      const lastCompressed = compressedLogs[compressedLogs.length - 1];
                      if (lastCompressed && lastCompressed.log.event === log.event) {
                        // Same event as previous, compress it
                        lastCompressed.count += 1;
                        lastCompressed.ids.push(log.id);
                        // Update to show the earliest timestamp for compressed group
                        if (new Date(log.timestamp).getTime() < new Date(lastCompressed.log.timestamp).getTime()) {
                          lastCompressed.log = log;
                        }
                      } else {
                        // Different event, add new entry
                        compressedLogs.push({
                          log,
                          count: 1,
                          ids: [log.id]
                        });
                      }
                    }

                    const displayedLogs = compressedLogs.slice(0, displayedLogCount);
                    const remainingLogs = compressedLogs.length - displayedLogCount;

                    return (
                      <>
                        {displayedLogs.map((compressed, index) => (
                          <div key={`${compressed.log.event}-${index}`} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {compressed.log.event}
                                  {compressed.count > 1 && (
                                    <span className="ml-1 text-xs opacity-75">×{compressed.count}</span>
                                  )}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(compressed.log.timestamp).toLocaleString('ko-KR')}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                ID: {compressed.count === 1 ? compressed.log.id : `${compressed.ids[0]}...`}
                              </Badge>
                            </div>
                            {compressed.log.message && (
                              <p className="text-sm text-gray-700 mb-2">{compressed.log.message}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {compressed.log.draft_id && (
                                <div className="text-muted-foreground">
                                  Draft: {compressed.log.draft_id}
                                </div>
                              )}
                              {compressed.log.schedule_id && (
                                <div className="text-muted-foreground">
                                  Schedule: {compressed.log.schedule_id}
                                </div>
                              )}
                            </div>
                            {compressed.count > 1 && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {compressed.count} identical events compressed
                              </div>
                            )}
                          </div>
                        ))}
                        {remainingLogs > 0 && (
                          <div className="text-center py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDisplayedLogCount(prev => Math.min(prev + 20, compressedLogs.length))}
                              className="border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-foreground/50"
                            >
                              Load {Math.min(20, remainingLogs)} more logs ({remainingLogs} remaining)
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="persona" className="space-y-4">
            {/* Extract persona snapshot from logs */}
            {(() => {
              const personaLog = logs.find(log => log.persona_snapshot);
              const personaSnapshot = personaLog?.persona_snapshot;

              if (!personaSnapshot || !isValidPersonaSnapshot(personaSnapshot)) {
                return (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No persona data available</p>
                    <p className="text-xs">Persona details will appear after content generation</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-900 mb-2">Basic Info</h5>
                      <div className="space-y-1 text-sm">
                        {personaSnapshot.name && <p><strong>Name:</strong> {personaSnapshot.name}</p>}
                        {personaSnapshot.language && <p><strong>Language:</strong> {personaSnapshot.language}</p>}
                        {personaSnapshot.tone && <p><strong>Tone:</strong> {personaSnapshot.tone}</p>}
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-green-900 mb-2">Content Style</h5>
                      <div className="space-y-1 text-sm">
                        {personaSnapshot.pillars && personaSnapshot.pillars.length > 0 && (
                          <p><strong>Pillars:</strong> {personaSnapshot.pillars.join(', ')}</p>
                        )}
                        {personaSnapshot.default_hashtags && personaSnapshot.default_hashtags.length > 0 && (
                          <p><strong>Hashtags:</strong> {personaSnapshot.default_hashtags.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {personaSnapshot.bio && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h5 className="font-medium text-purple-900 mb-2">Biography</h5>
                      <p className="text-sm text-gray-700">{personaSnapshot.bio}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            {/* Extract trend snapshot from logs */}
            {(() => {
              const trendLog = logs.find(log => log.trend_snapshot);
              const trendSnapshot = trendLog?.trend_snapshot;

              if (!trendSnapshot || !isValidTrendSnapshot(trendSnapshot)) {
                return (
                  <div className="text-center text-muted-foreground py-8">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No trend data available</p>
                    <p className="text-xs">Trend analysis will appear after content generation</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <h5 className="font-medium text-blue-900">Trend Source</h5>
                      <p className="text-sm text-gray-700">
                        Country: {trendSnapshot.country || 'N/A'} | Source: {trendSnapshot.source || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Retrieved: {trendSnapshot.retrieved_at ? new Date(trendSnapshot.retrieved_at).toLocaleString('ko-KR') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {trendSnapshot.items && trendSnapshot.items.length > 0 && (
                    <div>
                      <h5 className="font-medium text-foreground mb-2">Top Trends</h5>
                      <div className="space-y-2">
                        {trendSnapshot.items.map((item: {
                          title?: string;
                          name?: string;
                          rank?: number;
                          description?: string;
                        }, index: number) => (
                          <div key={index} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <h6 className="font-medium text-sm">{item.title || item.name || `Trend ${index + 1}`}</h6>
                              {item.rank && (
                                <Badge variant="outline" className="text-xs">
                                  Rank #{item.rank}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-600">{item.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="kpis" className="space-y-4">
            {/* Extract KPI snapshot from logs */}
            {(() => {
              const kpiLog = logs.find(log => log.kpi_snapshot);
              const kpiSnapshot = kpiLog?.kpi_snapshot;

              if (!kpiSnapshot || !isValidKpiSnapshot(kpiSnapshot)) {
                return (
                  <div className="text-center text-muted-foreground py-8">
                    <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No KPI data available</p>
                    <p className="text-xs">Performance metrics will appear after content publishing</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <h5 className="font-medium text-foreground">Performance Metrics</h5>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(kpiSnapshot).map(([key, value]: [string, unknown]) => (
                      <div key={key} className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-green-900">{key}</span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LLM Context if available */}
                  {(() => {
                    const llmLog = logs.find(log => log.llm_input || log.llm_output);
                    if (llmLog) {
                      const llmInput = llmLog.llm_input;
                      const llmOutput = llmLog.llm_output;

                      if ((llmInput && isValidLlmData(llmInput)) || (llmOutput && isValidLlmData(llmOutput))) {
                        return (
                          <div className="border-t pt-4">
                            <h5 className="font-medium text-foreground mb-2">AI Generation Context</h5>
                            <div className="space-y-2">
                              {llmInput && isValidLlmData(llmInput) && (
                                <div className="p-3 bg-yellow-50 rounded-lg">
                                  <h6 className="text-sm font-medium text-yellow-900 mb-1">Input Prompt</h6>
                                  <p className="text-xs text-gray-700 line-clamp-3">{llmInput.prompt || JSON.stringify(llmInput)}</p>
                                </div>
                              )}
                              {llmOutput && isValidLlmData(llmOutput) && (
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <h6 className="text-sm font-medium text-blue-900 mb-1">Generated Content</h6>
                                  <p className="text-xs text-gray-700 line-clamp-3">{llmOutput.text || JSON.stringify(llmOutput)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

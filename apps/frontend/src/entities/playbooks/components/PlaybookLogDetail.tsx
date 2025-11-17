import { useBffPlaybookGetPlaybookLogDetailApiBffPlaybooksLogPlaybookLogIdGet } from "@/lib/api/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, Target, MessageSquare, Hash, Clock, Zap, Database, Calendar, FileText } from "lucide-react";

// Type guards for safer type checking
const isValidPersonaSnapshot = (obj: unknown): obj is {
  name?: string;
  language?: string;
  tone?: string;
  pillars?: string[];
  default_hashtags?: string[];
  bio?: string;
} => obj !== null && typeof obj === 'object';

const isValidTrendSnapshot = (obj: unknown): obj is {
  country?: string;
  source?: string;
  retrieved_at?: string;
  items?: Array<{ title?: string; name?: string; rank?: number; description?: string }>;
} => obj !== null && typeof obj === 'object';

const isValidKpiSnapshot = (obj: unknown): obj is Record<string, unknown> =>
  obj !== null && typeof obj === 'object';

const isValidLlmData = (obj: unknown): obj is { prompt?: string; text?: string } =>
  obj !== null && typeof obj === 'object';

export function PlaybookLogDetail({ playbookLogId }: { playbookLogId: number }) {
  const { data: logDetail, isLoading, isError } = useBffPlaybookGetPlaybookLogDetailApiBffPlaybooksLogPlaybookLogIdGet(playbookLogId);

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (isError || !logDetail) return (
    <Card className="border-red-200 bg-red-50/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-red-600">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-sm">Failed to load log details</span>
        </div>
      </CardContent>
    </Card>
  );

  const log = logDetail.log;

  return (
    <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
      {/* Compact Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Database className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                Log #{log.id}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(log.timestamp).toLocaleString('ko-KR')}
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {log.event}
                </div>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
            PB-{log.playbook_id}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-2 mt-3">
          {log.draft_id && <Badge variant="outline" className="text-xs">Draft #{log.draft_id}</Badge>}
          {log.schedule_id && <Badge variant="outline" className="text-xs">Schedule #{log.schedule_id}</Badge>}
          {log.abtest_id && <Badge variant="outline" className="text-xs">A/B Test #{log.abtest_id}</Badge>}
          {log.ref_id && <Badge variant="outline" className="text-xs">Ref #{log.ref_id}</Badge>}
        </div>

        {log.message && (
          <div className="mt-3 p-3 bg-white/70 rounded-md border border-slate-200">
            <p className="text-sm text-slate-700 leading-relaxed">{log.message}</p>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4">
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100">
            <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
            <TabsTrigger value="persona" className="text-xs">Persona</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs">Trends</TabsTrigger>
            <TabsTrigger value="llm" className="text-xs">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="mt-4 space-y-3">
            {log.kpi_snapshot && isValidKpiSnapshot(log.kpi_snapshot) && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">KPI Metrics</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(log.kpi_snapshot).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-xs py-1 px-2 bg-white/50 rounded">
                      <span className="text-slate-600">{key}:</span>
                      <span className="font-medium text-slate-800">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {log.meta && (
              <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Metadata</span>
                </div>
                <div className="bg-white/70 p-2 rounded text-xs font-mono text-slate-700 max-h-32 overflow-y-auto">
                  {JSON.stringify(log.meta, null, 2)}
                </div>
              </div>
            )}

            {(!log.kpi_snapshot && !log.meta) && (
              <div className="text-center py-6 text-slate-500">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data snapshots available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="persona" className="mt-4">
            {log.persona_snapshot && isValidPersonaSnapshot(log.persona_snapshot) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Profile</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {log.persona_snapshot.name && <div><span className="font-medium">Name:</span> {log.persona_snapshot.name}</div>}
                      {log.persona_snapshot.language && <div><span className="font-medium">Language:</span> {log.persona_snapshot.language}</div>}
                      {log.persona_snapshot.tone && <div><span className="font-medium">Tone:</span> {log.persona_snapshot.tone}</div>}
                    </div>
                  </div>

                  {(log.persona_snapshot.pillars || log.persona_snapshot.default_hashtags) && (
                    <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Content Style</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {log.persona_snapshot.pillars && <div><span className="font-medium">Pillars:</span> {log.persona_snapshot.pillars.join(', ')}</div>}
                        {log.persona_snapshot.default_hashtags && <div><span className="font-medium">Hashtags:</span> {log.persona_snapshot.default_hashtags.join(', ')}</div>}
                      </div>
                    </div>
                  )}

                  {log.persona_snapshot.bio && (
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                      <div className="text-xs text-slate-700 leading-relaxed">{log.persona_snapshot.bio}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No persona data</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="mt-4">
            {log.trend_snapshot && isValidTrendSnapshot(log.trend_snapshot) ? (
              <div className="space-y-3">
                <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Trend Source</span>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <div>📍 {log.trend_snapshot.country || 'Unknown'} • {log.trend_snapshot.source || 'Unknown'}</div>
                    <div className="text-slate-500">
                      {log.trend_snapshot.retrieved_at ? new Date(log.trend_snapshot.retrieved_at).toLocaleString('ko-KR') : 'No date'}
                    </div>
                  </div>
                </div>

                {log.trend_snapshot.items && log.trend_snapshot.items.length > 0 && (
                  <div className="space-y-2">
                    {log.trend_snapshot.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-800 truncate pr-2">
                            {item.title || item.name || `Trend ${index + 1}`}
                          </span>
                          {item.rank && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              #{item.rank}
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No trend data</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="llm" className="mt-4">
            {(log.llm_input || log.llm_output) ? (
              <div className="space-y-3">
                {log.llm_input && isValidLlmData(log.llm_input) && (
                  <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">AI Input</span>
                    </div>
                    <div className="space-y-2">
                      {log.llm_input.prompt && (
                        <div className="text-xs text-slate-700 bg-white/50 p-2 rounded">
                          <div className="font-medium mb-1">Prompt:</div>
                          <div className="line-clamp-3">{log.llm_input.prompt}</div>
                        </div>
                      )}
                      {log.llm_input.text && (
                        <div className="text-xs text-slate-700 bg-white/50 p-2 rounded">
                          <div className="font-medium mb-1">Text:</div>
                          <div className="line-clamp-2">{log.llm_input.text}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {log.llm_output && isValidLlmData(log.llm_output) && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">AI Output</span>
                    </div>
                    <div className="space-y-2">
                      {log.llm_output.text && (
                        <div className="text-xs text-slate-700 bg-white/50 p-2 rounded">
                          <div className="font-medium mb-1">Generated:</div>
                          <div className="line-clamp-3">{log.llm_output.text}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No AI data</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

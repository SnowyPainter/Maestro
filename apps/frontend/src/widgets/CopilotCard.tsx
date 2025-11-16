import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { GraphRagActionCard } from "@/lib/api/generated"
import {
  Brain,
  Compass,
  Layers,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import type { CopilotActionGroup } from "./useGraphRagSuggestions"

interface CopilotCardProps {
  roi: {
    memoryReuse: number
    savedMinutes: number
    automationRate: number
  } | null
  actions: GraphRagActionCard[]
  actionGroups?: CopilotActionGroup[]
  summary?: string | null
  personaName?: string | null
  campaignName?: string | null
  updatedAt?: string | null
  isLive?: boolean
  onExecute?: (card?: GraphRagActionCard | null) => void
  isLoading?: boolean
  isExecuting?: boolean
}

export function CopilotCard({
  roi,
  actions,
  actionGroups,
  summary,
  personaName,
  campaignName,
  updatedAt,
  isLive = false,
  onExecute,
  isLoading = false,
  isExecuting = false,
}: CopilotCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    setCurrentIndex(0)
  }, [actions])

  const hasActions = actions.length > 0
  const currentAction = hasActions ? actions[currentIndex] : null

  const handleExecute = (card?: GraphRagActionCard | null) => {
    const target = card ?? currentAction
    if (!target || !onExecute) {
      return
    }
    onExecute(target)
  }

  const formatUpdated = (value?: string | null) => {
    if (!value) return "Waiting for live signals"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "Updated just now"
    const diffMs = Date.now() - parsed.getTime()
    const diffSec = Math.max(0, Math.floor(diffMs / 1000))
    if (diffSec < 60) return `Updated ${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `Updated ${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    return `Updated ${diffHr}h ago`
  }

  const groups = useMemo(() => {
    if (actionGroups && actionGroups.length) {
      return actionGroups
    }
    const fallbackGroups: CopilotActionGroup[] = [
      { key: "trend", title: "Trend-driven Next Actions", cards: actions.filter((card) => card.category === "trend") },
      { key: "draft", title: "Next Steps & Drafts", cards: actions.filter((card) => card.category === "draft") },
      { key: "playbook", title: "Memory & Playbooks", cards: actions.filter((card) => card.category === "playbook") },
      { key: "persona", title: "Persona & Focus", cards: actions.filter((card) => card.category === "persona") },
    ]
    return fallbackGroups.filter((group) => group.cards.length > 0)
  }, [actionGroups, actions])

  const personaLine = personaName ? `Persona: ${personaName}` : "Persona: Not selected"
  const campaignLine = campaignName ? `Campaign: ${campaignName}` : "Campaign: Not set"

  const renderBadge = (card: GraphRagActionCard) => {
    const kind = (card.meta as Record<string, unknown> | undefined)?.["kind"]
    if (typeof kind !== "string") {
      return null
    }
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        {kind}
      </span>
    )
  }

  const renderGroupTitleIcon = (key: string) => {
    switch (key) {
      case "trend":
        return <Sparkles className="h-3.5 w-3.5 text-amber-600" />
      case "draft":
        return <Layers className="h-3.5 w-3.5 text-indigo-600" />
      case "playbook":
        return <Brain className="h-3.5 w-3.5 text-emerald-600" />
      case "persona":
        return <Compass className="h-3.5 w-3.5 text-slate-600" />
      default:
        return <Sparkles className="h-3.5 w-3.5 text-slate-600" />
    }
  }

  return (
    <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="rounded-lg border bg-muted/40 px-2.5 py-1.5 shadow-sm">
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-600" />
              AI Thinking
            </div>
            <p className="text-[11px] text-slate-700 leading-tight">
              {summary || currentAction?.title || "Listening for new signals"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              <span>{formatUpdated(updatedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Radio className={`h-2.5 w-2.5 ${isLive ? "text-emerald-500" : "text-slate-400"}`} />
              <span className={isLive ? "text-emerald-600" : ""}>{isLive ? "Live" : "Idle"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-700">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
          <Compass className="h-3.5 w-3.5 text-slate-600" />
          {personaLine}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
          <Layers className="h-3.5 w-3.5" />
          {campaignLine}
        </span>
      </div>

      <div className="space-y-1">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.key} className="space-y-1 rounded-lg border bg-white/60 p-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 flex items-center gap-1">
                    {renderGroupTitleIcon(group.key)}
                    {group.title}
                  </span>
                  {group.helper ? (
                    <span className="text-[10px] text-muted-foreground">{group.helper}</span>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground">×{group.cards.length}</span>
              </div>

              <div className="space-y-0.5">
                {group.cards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded border border-slate-100 bg-slate-50/50 px-2 py-1"
                  >
                    <div className="space-y-1.5">
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-semibold text-slate-800 leading-tight">{card.title}</p>
                        <p className="text-[10px] text-slate-600 leading-tight">
                          {card.description ||
                            (typeof card.meta?.summary === "string"
                              ? card.meta.summary
                              : "Graph RAG recommendation")}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                          {card.persona?.persona_name ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              {card.persona.persona_name}
                            </span>
                          ) : null}
                          {card.persona?.campaign_name ? (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                              {card.persona.campaign_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleExecute(card)}
                        disabled={!onExecute || isExecuting}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 text-[11px] py-1 h-7"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {isExecuting ? "Executing..." : card.cta_label ?? "Run"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded border border-dashed bg-muted/40 px-2 py-3 text-center text-[10px] text-muted-foreground">
            {isLoading ? "Waiting for Graph RAG suggestions..." : "No actionable suggestions yet."}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            ROI Insights
          </div>
          <span className="text-[11px] text-muted-foreground">Always-on justification</span>
        </div>

        {roi ? (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200/50">
              <div className="p-1.5 bg-emerald-500 rounded-md mb-1">
                <Brain className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-emerald-700 uppercase tracking-wide font-medium text-center leading-tight">
                Reuse
              </p>
              <p className="text-sm font-bold text-emerald-800">{roi.memoryReuse}×</p>
            </div>
            <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
              <div className="p-1.5 bg-blue-500 rounded-md mb-1">
                <TrendingUp className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-blue-700 uppercase tracking-wide font-medium text-center leading-tight">
                Saved
              </p>
              <p className="text-sm font-bold text-blue-800">{roi.savedMinutes}m</p>
            </div>
            <div className="flex flex-col items-center justify-center p-2 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200/50">
              <div className="p-1.5 bg-purple-500 rounded-md mb-1">
                <Play className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-purple-700 uppercase tracking-wide font-medium text-center leading-tight">
                Auto
              </p>
              <p className="text-sm font-bold text-purple-800">{(roi.automationRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-2 border rounded-lg">
            {isLoading ? "Loading Graph RAG ROI..." : "ROI data not available yet."}
          </div>
        )}
      </div>
    </div>
  )
}

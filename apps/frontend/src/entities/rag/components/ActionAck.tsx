import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles, Clock, Settings, FileText, Target, User, BarChart3 } from "lucide-react"
import {
  GraphRagActionAck,
  GraphRagActionAckAudit,
  GraphRagActionAckIntent,
} from "@/lib/api/generated"

interface ActionAckProps {
  data: GraphRagActionAck
  title?: string | null
  onValueClick?: (key: string, value: unknown) => void
}

const intentLabels: Record<NonNullable<GraphRagActionAckIntent>, string> = {
  trend_followup: "Trend follow-up",
  next_action: "Next action",
  playbook_reuse: "Playbook reuse",
  persona_focus: "Persona focus",
  other: "Action",
}

const ActionAck: React.FC<ActionAckProps> = ({ data, title, onValueClick }) => {
  const [showMetaDialog, setShowMetaDialog] = useState(false)

  if (!data) return null

  const status = data.status || "info"
  const message = data.message || ""
  const meta = data.meta || {}

  const statusConfig = getStatusConfig(status)
  const IconComponent = statusConfig.icon

  return (
    <div className={`rounded-xl border-1 overflow-hidden`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 p-2 rounded-lg bg-gradient-to-br ${statusConfig.gradient || 'from-muted to-muted/50'} shadow-sm`}>
            <IconComponent className={`h-4 w-4 ${statusConfig.textColor}`} />
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <Badge variant={statusConfig.badgeVariant} className="px-2 py-1 text-xs font-semibold shadow-sm">
                {status}
              </Badge>
              {data.intent && (
                <Badge variant="secondary" className="px-2 py-1 text-xs shadow-sm">
                  {renderIntentLabel(data.intent)}
                </Badge>
              )}
              {data.action_key && (
                <Badge variant="outline" className="px-2 py-1 text-xs font-mono shadow-sm">
                  {data.action_key}
                </Badge>
              )}
              {typeof data.confidence === "number" && (
                <Badge variant="outline" className="px-2 py-1 text-xs gap-1 shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  {(data.confidence * 100).toFixed(0)}%
                </Badge>
              )}
              {typeof data.timing_ms === "number" && (
                <Badge variant="outline" className="px-2 py-1 text-xs gap-1 shadow-sm">
                  <Clock className="h-3 w-3" /> {data.timing_ms}ms
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground font-medium leading-snug flex-1">
                {title || "Action Result"} — {message}
              </div>
              {hasEntries(meta) && (
                <Dialog open={showMetaDialog} onOpenChange={setShowMetaDialog}>
                  <DialogTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-muted/70 transition-all duration-200 hover:scale-105">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-semibold">Metadata</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      <KvSection title="Meta" entries={meta} onValueClick={onValueClick} />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-3">
          {hasEntries(data.inputs) && (
            <KvSection title="Inputs" entries={data.inputs} onValueClick={onValueClick} />
          )}
          {hasEntries(data.outputs) && (
            <OutputsSection entries={data.outputs} onValueClick={onValueClick} />
          )}
        </div>
      </div>
    </div>
  )
}

function OutputsSection({
  entries,
  onValueClick,
}: {
  entries?: Record<string, unknown>
  onValueClick?: (key: string, value: unknown) => void
}) {
  if (!entries) return null
  const list = Object.entries(entries).filter(([_, v]) => v !== undefined && v !== null)
  if (!list.length) return null

  // log 관련 항목들은 우선순위 낮게 처리
  const primaryEntries = list.filter(([key]) => !key.includes('log') && !key.includes('audit'))
  const secondaryEntries = list.filter(([key]) => key.includes('log') || key.includes('audit'))

  const renderSpecialValue = (key: string, value: unknown) => {
    if (key === 'draft_id') {
      return (
        <div className="flex flex-col items-center gap-1">
          <FileText className="h-4 w-4 text-emerald-600" />
          <span className="text-[10px] font-medium text-emerald-700 leading-tight">New Draft!</span>
        </div>
      )
    }
    if (key === 'campaign_id') {
      return (
        <div className="flex flex-col items-center gap-1">
          <Target className="h-4 w-4 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-700 leading-tight">Campaign Updated!</span>
        </div>
      )
    }
    if (key === 'persona_id') {
      return (
        <div className="flex flex-col items-center gap-1">
          <User className="h-4 w-4 text-purple-600" />
          <span className="text-[10px] font-medium text-purple-700 leading-tight">Persona Linked!</span>
        </div>
      )
    }
    if (key === 'playbook_log_id') {
      return (
        <div className="flex flex-col items-center gap-1">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          <span className="text-[10px] font-medium text-indigo-700 leading-tight">Playbook Executed!</span>
        </div>
      )
    }
    return null
  }

  // Sort entries by priority (special renders first, then regular items, then log items)
  const specialEntries = primaryEntries.filter(([key]) =>
    key === 'draft_id' || key === 'campaign_id' || key === 'persona_id' || key === 'playbook_log_id'
  )
  const regularEntries = primaryEntries.filter(([key]) =>
    !specialEntries.some(([specialKey]) => specialKey === key)
  )
  const sortedEntries = [...specialEntries, ...regularEntries, ...secondaryEntries]

  return (
    <div className="rounded-xl bg-white/80 p-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-bold text-slate-700 tracking-wide">Results</span>
        </div>
      </div>

      {/* 5x5 grid layout */}
      <div className="grid grid-cols-5 gap-2">
        {sortedEntries.map(([key, value]) => {
          const specialRender = renderSpecialValue(key, value)
          const isLogItem = key.includes('log') || key.includes('audit')

          if (specialRender) {
            return (
              <div
                key={key}
                className="bg-slate-50 rounded-lg p-2 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onValueClick?.(key, value)}
              >
                <div className="text-center">
                  {specialRender}
                </div>
              </div>
            )
          }

          return (
            <div
              key={key}
              className={`rounded p-2 border cursor-pointer transition-colors ${
                isLogItem
                  ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-xs'
              }`}
              onClick={() => onValueClick?.(key, value)}
            >
              <div className="text-center">
                <div className={`font-medium capitalize leading-tight ${
                  isLogItem ? 'text-slate-600' : 'text-slate-700'
                }`}>
                  {key.replace(/_/g, " ")}
                </div>
                <div className={`font-mono truncate leading-tight ${
                  isLogItem ? 'text-slate-500' : 'text-slate-800'
                }`}>
                  {renderValue(value)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KvSection({
  title,
  entries,
  highlightKeys = [],
  onValueClick,
}: {
  title: string
  entries?: Record<string, unknown>
  highlightKeys?: string[]
  onValueClick?: (key: string, value: unknown) => void
}) {
  if (!entries) return null
  const list = Object.entries(entries).filter(([_, v]) => v !== undefined && v !== null)
  if (!list.length) return null

  const isClickableValue = (key: string) => {
    return highlightKeys.includes(key) || key.endsWith('_id') || key === 'node_id'
  }

  return (
    <div className="rounded-md border border-border p-2 space-y-1.5 bg-muted/20">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</div>
      <div className="space-y-1">
        {list.map(([key, value]) => (
          <div key={key} className="flex gap-2 text-[11px]">
            <span className="text-muted-foreground min-w-[80px] capitalize shrink-0">
              {key.replace(/_/g, " ")}
            </span>
            <span
              className={`font-mono break-all leading-tight ${
                isClickableValue(key)
                  ? "text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                  : highlightKeys.includes(key)
                    ? "text-emerald-700 font-semibold"
                    : "text-foreground"
              }`}
              onClick={isClickableValue(key) ? () => onValueClick?.(key, value) : undefined}
            >
              {renderValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AuditSection({ audit }: { audit: GraphRagActionAckAudit }) {
  const list = Object.entries(audit || {}).filter(([_, v]) => v !== undefined && v !== null)
  if (!list.length) return null
  return (
    <div className="rounded-md border border-dashed border-border p-2 space-y-1.5 bg-muted/10">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">LLM / Audit</div>
      <div className="space-y-1 text-[11px]">
        {list.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-muted-foreground min-w-[100px] capitalize shrink-0">
              {key.replace(/_/g, " ")}
            </span>
            <span className="font-mono break-all text-foreground leading-tight">
              {renderValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function hasEntries(obj?: Record<string, unknown>): boolean {
  if (!obj) return false
  return Object.values(obj).some((v) => v !== undefined && v !== null)
}

function renderValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function renderIntentLabel(intent?: GraphRagActionAckIntent): string {
  if (!intent) return "Action"
  return intentLabels[intent] || "Action"
}

type StatusConfig = {
  icon: React.ComponentType<{ className?: string }>
  borderColor: string
  textColor: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline"
  gradient?: string
}

function getStatusConfig(status: string): StatusConfig {
  switch (status.toLowerCase()) {
    case "success":
    case "completed":
    case "draft_created":
    case "logged":
      return {
        icon: CheckCircle2,
        borderColor: "border-emerald-200",
        textColor: "text-emerald-800",
        badgeVariant: "default",
        gradient: "from-emerald-50 to-emerald-100",
      }
    case "error":
    case "failed":
      return {
        icon: XCircle,
        borderColor: "border-red-200",
        textColor: "text-red-800",
        badgeVariant: "destructive",
        gradient: "from-red-50 to-red-100",
      }
    case "warning":
      return {
        icon: AlertTriangle,
        borderColor: "border-amber-200",
        textColor: "text-amber-800",
        badgeVariant: "secondary",
        gradient: "from-amber-50 to-amber-100",
      }
    default:
      return {
        icon: Info,
        borderColor: "border-blue-200",
        textColor: "text-blue-800",
        badgeVariant: "secondary",
        gradient: "from-blue-50 to-blue-100",
      }
  }
}

export default ActionAck

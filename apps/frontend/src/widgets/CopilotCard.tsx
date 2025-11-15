import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { GraphRagActionCard } from "@/lib/api/generated"
import { Brain, ChevronLeft, ChevronRight, Play, TrendingUp } from "lucide-react"

interface CopilotCardProps {
  roi: {
    memoryReuse: number
    savedMinutes: number
    automationRate: number
  } | null
  actions: GraphRagActionCard[]
  onExecute?: (card?: GraphRagActionCard | null) => void
  isLoading?: boolean
  isExecuting?: boolean
}

export function CopilotCard({
  roi,
  actions,
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

  const handleExecute = () => {
    if (!currentAction || !onExecute) {
      return
    }
    onExecute(currentAction)
  }

  const handlePrev = () => {
    if (!hasActions) {
      return
    }
    setCurrentIndex((idx) => (idx - 1 + actions.length) % actions.length)
  }

  const handleNext = () => {
    if (!hasActions) {
      return
    }
    setCurrentIndex((idx) => (idx + 1) % actions.length)
  }

  return (
    <div className="space-y-2">

      <div className="space-y-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Current Task
        </span>
        <div className="rounded-2xl p-4">
          {currentAction ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Action {currentIndex + 1} / {actions.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handlePrev}
                    disabled={actions.length <= 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNext}
                    disabled={actions.length <= 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{currentAction.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed max-w-[220px] mx-auto">
                  {currentAction.description || (typeof currentAction.meta?.summary === "string" ? currentAction.meta.summary : "Graph RAG recommendation")}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={!onExecute || isExecuting}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 font-medium disabled:opacity-60"
              >
                <Play className="h-4 w-4 mr-2" />
                {isExecuting ? "Executing..." : currentAction.cta_label ?? "Execute Action"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {isLoading ? "Waiting for Graph RAG suggestions..." : "No actionable suggestion yet."}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
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
          <div className="text-center text-xs text-muted-foreground py-4 border rounded-lg">
            {isLoading ? "Loading Graph RAG ROI..." : "ROI data not available yet."}
          </div>
        )}
      </div>
    </div>
  )
}

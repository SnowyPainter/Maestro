import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  ArrowRight,
  Calendar,
  User,
  Target,
  Play
} from "lucide-react"
import { RagNextActionProposal } from "@/lib/api/generated"

interface NextActionsProps {
  data: RagNextActionProposal[]
  onExecuteAction?: (action: RagNextActionProposal) => void
}

const SHOW_LIMIT = 3

const NextActions: React.FC<NextActionsProps> = ({ data, onExecuteAction }) => {
  const [showMore, setShowMore] = useState(false)

  if (!data || data.length === 0) {
    return null
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-500"
    if (confidence >= 0.8) return "bg-green-500"
    if (confidence >= 0.6) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return "Unknown"
    if (confidence >= 0.8) return "High"
    if (confidence >= 0.6) return "Medium"
    return "Low"
  }

  // 표시 제한 적용
  const visibleItems = showMore ? data : data.slice(0, SHOW_LIMIT)
  const hasMore = data.length > SHOW_LIMIT

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-medium text-foreground">Next Actions</h3>
      </div>

      <div className="space-y-2">
        {visibleItems.map((action, index) => (
          <div key={index} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm truncate">{action.title}</h4>
                  {action.confidence !== undefined && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${getConfidenceColor(action.confidence)}`} />
                      {getConfidenceLabel(action.confidence)}
                    </Badge>
                  )}
                  {action.persona?.persona_name && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <User className="h-3 w-3 mr-1" />
                      {action.persona.persona_name}
                    </Badge>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground flex-1 line-clamp-2">
                    {action.action}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  {action.suggested_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(action.suggested_at)}</span>
                    </div>
                  )}
                  {action.confidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence</span>
                      <div className="w-16">
                        <Progress value={action.confidence * 100} className="h-1.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {onExecuteAction && (
                <Button
                  size="sm"
                  onClick={() => onExecuteAction(action)}
                  className="shrink-0 mt-1"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Execute
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show more / less 버튼 */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMore((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showMore ? (
              <>
                Show less <ChevronUp className="h-3 w-3 ml-1" />
              </>
            ) : (
              <>
                Show more ({data.length - SHOW_LIMIT} more) <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default NextActions

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  Lightbulb,
  RotateCcw,
  Calendar,
  User,
  ChevronRight
} from "lucide-react"
import { RagMemoryHighlight } from "@/lib/api/generated"

interface MemoryHighlightsProps {
  data: RagMemoryHighlight[]
  onNavigate?: (nodeId: string) => void
}

const SHOW_LIMIT = 3

const MemoryHighlights: React.FC<MemoryHighlightsProps> = ({ data, onNavigate }) => {
  const [showMore, setShowMore] = useState(false)

  if (!data || data.length === 0) {
    return null
  }

  // 표시 제한 적용
  const visibleItems = showMore ? data : data.slice(0, SHOW_LIMIT)
  const hasMore = data.length > SHOW_LIMIT

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium text-foreground">Memory Highlights</h3>
      </div>

      <div className="space-y-2">
        {visibleItems.map((highlight, index) => (
          <div key={index} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                {highlight.title && (
                  <h4 className="font-medium text-sm truncate">{highlight.title}</h4>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {highlight.reuse_count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Used {highlight.reuse_count}x
                    </Badge>
                  )}
                  {highlight.last_used_at && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(highlight.last_used_at)}
                    </Badge>
                  )}
                  {highlight.persona?.persona_name && (
                    <Badge variant="outline" className="text-xs">
                      <User className="h-3 w-3 mr-1" />
                      {highlight.persona.persona_name}
                    </Badge>
                  )}
                </div>

                {highlight.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {highlight.summary}
                  </p>
                )}

                {highlight.reasons && highlight.reasons.length > 0 && (
                  <div className="pt-1">
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {highlight.reasons.slice(0, 2).map((reason, reasonIndex) => (
                        <li key={reasonIndex} className="flex items-start gap-1">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span className="line-clamp-1">{reason}</span>
                        </li>
                      ))}
                      {highlight.reasons.length > 2 && (
                        <li className="text-amber-500 text-xs">• +{highlight.reasons.length - 2} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {highlight.node_id && onNavigate && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigate(highlight.node_id!)}
                  className="shrink-0 mt-1"
                >
                  <ChevronRight className="h-4 w-4" />
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

export default MemoryHighlights

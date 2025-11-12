import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Zap, User } from "lucide-react"
import { RagQuickstartTemplate } from "@/lib/api/generated"

interface QuickStartsProps {
  data: RagQuickstartTemplate[]
  onQuickStartClick?: (query: string) => void
}

const SHOW_LIMIT = 3

const QuickStarts: React.FC<QuickStartsProps> = ({ data, onQuickStartClick }) => {
  const [showMore, setShowMore] = useState(false)

  if (!data || data.length === 0) {
    return null
  }

  // 표시 제한 적용
  const visibleItems = showMore ? data : data.slice(0, SHOW_LIMIT)
  const hasMore = data.length > SHOW_LIMIT

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-medium text-foreground">Quick Starts</h3>
      </div>

      <div className="space-y-2">
        {visibleItems.map((template, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{template.title}</h4>
                {template.persona?.persona_name && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    <User className="h-3 w-3 mr-1" />
                    {template.persona.persona_name}
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                  {template.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate">
                Query: {template.query}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickStartClick?.(template.query)}
              className="shrink-0 ml-2"
            >
              Use
            </Button>
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

export default QuickStarts

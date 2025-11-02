import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Expand } from "lucide-react"
import { RagRelatedEdge } from "@/lib/api/generated"
import { NODE_TYPE_COLORS } from "./shared/constants"
import { parseMetaInfo } from "./shared/metaUtils"

interface RelatedNodeCardProps {
  edge: RagRelatedEdge
  onExpand?: (nodeId: string, nodeType: string, nodeTitle?: string) => void
}

const RelatedNodeCard: React.FC<RelatedNodeCardProps> = ({ edge, onExpand }) => {
  const nodeColor =
    NODE_TYPE_COLORS[edge.node_type || "default"] ||
    NODE_TYPE_COLORS.default
  const parsedMeta = edge.node_meta ? parseMetaInfo(edge.node_meta) : []

  return (
    <Card className="w-full border-border/50 shadow-none hover:border-accent transition-colors">
      <CardContent className="p-2.5">
        <div className="flex items-start gap-2">
          {/* Text section */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            {edge.node_type && (
              <Badge
                className={`${nodeColor} text-[10px] px-1.5 py-0.5 font-medium mb-1`}
              >
                {edge.node_type
                  .replace("_", " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </Badge>
            )}

            {/* Title */}
            <h4 className="text-sm font-medium leading-tight truncate text-foreground">
              {edge.title || `Node ${edge.dst_node_id.slice(0, 8)}...`}
            </h4>

            {/* Summary */}
            {edge.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {edge.summary}
              </p>
            )}

            {/* Meta info */}
            {parsedMeta.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {parsedMeta.slice(0, 3).map((m, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] text-muted-foreground/70 truncate"
                  >
                    {m.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expand button */}
          {onExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onExpand?.(
                  edge.dst_node_id,
                  edge.node_type || "unknown",
                  edge.title || undefined,
                )
              }
              className="h-6 w-6 mt-0.5 hover:bg-accent"
            >
              <Expand className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default RelatedNodeCard

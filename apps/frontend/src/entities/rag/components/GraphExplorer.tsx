import React, { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Filter, ChevronDown, ChevronUp } from "lucide-react"
import {
  RagSearchResponse,
  RagRelatedEdge,
  RagExpandResponse,
  RagSearchItem,
} from "@/lib/api/generated"
import ParentNodeHeader from "./ParentNodeHeader"
import GraphNodeCard from "./GraphNodeCard"
import RelatedNodeCard from "./RelatedNodeCard"

interface GraphExplorerProps {
  data?: RagSearchResponse
  expandData?: RagExpandResponse
  edges?: RagRelatedEdge[]
  onExpandNode?: (
    nodeId: string,
    nodeType: string,
    nodeInfo?: { title?: string; meta?: Record<string, any> },
  ) => void
  onNavigate?: (nodeId: string, nodeType: string) => void
  parentNode?: {
    nodeId: string
    nodeType: string
    title?: string
    meta?: Record<string, any>
  }
}

const SHOW_LIMIT = 2

const GraphExplorer: React.FC<GraphExplorerProps> = ({
  data,
  expandData,
  edges,
  onExpandNode,
  onNavigate,
  parentNode,
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [showMore, setShowMore] = useState(false)

  const isEdgesMode =
    (edges && edges.length > 0) ||
    (expandData?.items && expandData.items.length > 0)

  const sourceItems = isEdgesMode
    ? (edges || expandData?.items || [])
    : (data?.items || [])

  const nodeTypes = useMemo(() => {
    const types = new Set(
      sourceItems.map((n: any) => n.node_type || "unknown"),
    )
    return Array.from(types).sort()
  }, [sourceItems])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const match = (txt?: string) => txt?.toLowerCase().includes(q)
    return sourceItems.filter((n: any) => {
      const inSearch =
        !q ||
        match(n.title) ||
        match(n.summary) ||
        (n.chunks || []).some((c: string) => match(c))
      const inType = selectedType === "all" || n.node_type === selectedType
      return inSearch && inType
    })
  }, [sourceItems, searchQuery, selectedType])

  const toggleNode = (id: string) =>
    setExpandedNodes((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleExpand = async (
    id: string,
    type: string,
    info?: { title?: string; meta?: Record<string, any> },
  ) => {
    if (onExpandNode) await onExpandNode(id, type, info)
  }

  // 표시 제한 적용
  const visibleItems = showMore ? filtered : filtered.slice(0, SHOW_LIMIT)
  const hasMore = filtered.length > SHOW_LIMIT

  return (
    <div className="w-full space-y-3">
      {parentNode && (
        <ParentNodeHeader
          parentNode={parentNode}
          onNavigate={(id, type) => onNavigate?.(id, type)}
        />
      )}

      {/* 필터 헤더 */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {nodeTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace("_", " ").replace(/\b\w/g, (l: string) =>
                  l.toUpperCase(),
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 노드 카드 */}
      <div className="space-y-2">
        {visibleItems.length > 0 ? (
          isEdgesMode ? (
            (visibleItems as RagRelatedEdge[]).map((edge, i) => (
              <RelatedNodeCard
                key={i}
                edge={edge}
                onExpand={(id, type, title) =>
                  handleExpand(id, type, {
                    title,
                    meta: edge.node_meta,
                  })
                }
              />
            ))
          ) : (
            (visibleItems as RagSearchItem[]).map((item) => (
              <div key={item.node_id} className="space-y-1">
                <GraphNodeCard
                  item={item}
                  isExpanded={expandedNodes.has(item.node_id)}
                  onToggleExpand={() => toggleNode(item.node_id)}
                  onExpandNode={(info) =>
                    handleExpand(item.node_id, item.node_type, info)
                  }
                />
                {item.related &&
                  expandedNodes.has(item.node_id) &&
                  item.related.map((edge, j) => (
                    <div key={j} className="ml-3">
                      <RelatedNodeCard
                        edge={edge}
                        onExpand={(id, type, title) =>
                          handleExpand(id, type, {
                            title,
                            meta: edge.node_meta,
                          })
                        }
                      />
                    </div>
                  ))}
              </div>
            ))
          )
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            No results found
          </div>
        )}

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
                  Show more <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default GraphExplorer

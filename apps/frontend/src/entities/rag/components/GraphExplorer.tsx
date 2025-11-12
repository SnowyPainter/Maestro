import React, { useMemo, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react"
import {
  RagSearchResponse,
  RagRelatedEdge,
  RagExpandResponse,
  RagSearchItem,
} from "@/lib/api/generated"
import ParentNodeHeader from "./ParentNodeHeader"
import GraphNodeCard from "./GraphNodeCard"
import RelatedNodeCard from "./RelatedNodeCard"
import QuickStarts from "./QuickStarts"
import ROI from "./ROI"
import MemoryHighlights from "./MemoryHighlights"
import NextActions from "./NextActions"

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

type TabType = 'explore' | 'quickstarts' | 'roi' | 'memory' | 'actions'

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
  const [currentTab, setCurrentTab] = useState<TabType>('explore')

  const isEdgesMode =
    (edges && edges.length > 0) ||
    (expandData?.items && expandData.items.length > 0)

  const sourceItems = isEdgesMode
    ? (edges || expandData?.items || [])
    : (data?.items || [])

  // Available tabs based on data
  const availableTabs = useMemo(() => {
    const tabs: { key: TabType; label: string; hasData: boolean; dataLength: number }[] = [
      { key: 'explore', label: 'Explore', hasData: true, dataLength: data?.items?.length || 0 }, // Always show explore
      { key: 'quickstarts', label: 'Quick Starts', hasData: !!(data?.quickstart && data.quickstart.length > 0), dataLength: data?.quickstart?.length || 0 },
      { key: 'roi', label: 'ROI', hasData: !!data?.roi, dataLength: data?.roi ? 1 : 0 },
      { key: 'memory', label: 'Memory Highlights', hasData: !!(data?.memory_highlights && data.memory_highlights.length > 0), dataLength: data?.memory_highlights?.length || 0 },
      { key: 'actions', label: 'Next Actions', hasData: !!(data?.next_actions && data.next_actions.length > 0), dataLength: data?.next_actions?.length || 0 },
    ]
    return tabs.filter(tab => tab.hasData)
  }, [data])

  // Set default tab to the one with most data
  const defaultTab = useMemo(() => {
    if (availableTabs.length === 0) return 'explore'
    const tabWithMostData = availableTabs.reduce((max, tab) =>
      tab.dataLength > max.dataLength ? tab : max
    )
    return tabWithMostData.key
  }, [availableTabs])

  // Update currentTab to defaultTab when data changes
  useEffect(() => {
    setCurrentTab(defaultTab)
  }, [defaultTab])

  const currentTabIndex = availableTabs.findIndex(tab => tab.key === currentTab)
  const canGoPrev = currentTabIndex > 0
  const canGoNext = currentTabIndex < availableTabs.length - 1

  const goToPrev = () => {
    if (canGoPrev) {
      setCurrentTab(availableTabs[currentTabIndex - 1].key)
    }
  }

  const goToNext = () => {
    if (canGoNext) {
      setCurrentTab(availableTabs[currentTabIndex + 1].key)
    }
  }

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

  const renderTabContent = () => {
    switch (currentTab) {
      case 'explore':
        return (
          <>
            {/* 필터 헤더 - explore 탭에서만 표시 */}
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
          </>
        )
      case 'quickstarts':
        return (
          <QuickStarts
            data={data?.quickstart || []}
            onQuickStartClick={(query) => {
              // TODO: Implement quick start query execution
              console.log('Execute quick start query:', query)
            }}
          />
        )
      case 'roi':
        return data?.roi ? <ROI data={data.roi} /> : null
      case 'memory':
        return (
          <MemoryHighlights
            data={data?.memory_highlights || []}
            onNavigate={(nodeId) => onNavigate?.(nodeId, 'memory_highlight')}
          />
        )
      case 'actions':
        return (
          <NextActions
            data={data?.next_actions || []}
            onExecuteAction={(action) => {
              // TODO: Implement action execution
              console.log('Execute action:', action)
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full space-y-3">
      {parentNode && (
        <ParentNodeHeader
          parentNode={parentNode}
          onNavigate={(id, type) => onNavigate?.(id, type)}
        />
      )}

      {/* 탭 네비게이션 */}
      {availableTabs.length > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrev}
            disabled={!canGoPrev}
            className="p-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {availableTabs[currentTabIndex]?.label}
            </span>
            <span className="text-xs text-muted-foreground">
              ({currentTabIndex + 1} of {availableTabs.length})
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={!canGoNext}
            className="p-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      {renderTabContent()}
    </div>
  )
}

export default GraphExplorer

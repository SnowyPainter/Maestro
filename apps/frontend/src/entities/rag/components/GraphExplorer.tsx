import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { RagSearchResponse, RagRelatedEdge, RagExpandResponse, RagSearchItem } from '@/lib/api/generated';
import ParentNodeHeader from './ParentNodeHeader';
import GraphNodeCard from './GraphNodeCard';
import RelatedNodeCard from './RelatedNodeCard';

interface GraphExplorerProps {
  data?: RagSearchResponse;
  expandData?: RagExpandResponse;
  edges?: RagRelatedEdge[];
  onExpandNode?: (nodeId: string, nodeType: string, nodeInfo?: { title?: string; meta?: Record<string, any> }) => void;
  onNavigate?: (nodeId: string, nodeType: string) => void;
  parentNode?: {
    nodeId: string;
    nodeType: string;
    title?: string;
    meta?: Record<string, any>;
  };
}

const GraphExplorer: React.FC<GraphExplorerProps> = ({ data, expandData, edges, onExpandNode, onNavigate, parentNode }) => {
  console.log('GraphExplorer rendered with onNavigate:', !!onNavigate, 'parentNode:', !!parentNode);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // edges나 expandData가 있으면 edges 모드로 동작
  const isEdgesMode = (edges && edges.length > 0) || (expandData?.items && expandData.items.length > 0);

  // 고유한 노드 타입들 추출
  const nodeTypes = useMemo(() => {
    if (isEdgesMode) {
      const sourceEdges = edges || expandData?.items || [];
      const types = new Set(sourceEdges.map(edge => edge.node_type || 'unknown'));
      return Array.from(types).sort();
    }
    const items = data?.items || [];
    const types = new Set(items.map(item => item.node_type));
    return Array.from(types).sort();
  }, [data?.items, edges, expandData?.items, isEdgesMode]);

  // 필터링된 아이템들 또는 edges
  const filteredItems = useMemo(() => {
    if (isEdgesMode) {
      const sourceEdges = edges || expandData?.items || [];
      return sourceEdges.filter(edge => {
        const matchesSearch = !searchQuery ||
          (edge.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (edge.summary?.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesType = selectedType === 'all' || edge.node_type === selectedType;

        return matchesSearch && matchesType;
      });
    }

    const items = data?.items || [];
    return items.filter(item => {
      const matchesSearch = !searchQuery ||
        (item.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.summary?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.chunks || []).some(chunk => chunk.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === 'all' || item.node_type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [data?.items, edges, expandData?.items, searchQuery, selectedType, isEdgesMode]);

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleExpandClick = async (nodeId: string, nodeType: string, nodeInfo?: { title?: string; meta?: Record<string, any> }) => {
    if (onExpandNode) {
      await onExpandNode(nodeId, nodeType, nodeInfo);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 부모 노드 정보 표시 */}
      {parentNode && (
        <ParentNodeHeader
          parentNode={parentNode}
          onNavigate={(nodeId, nodeType) => {
            console.log('GraphExplorer onNavigate wrapper called:', nodeId, nodeType, !!onNavigate);
            if (onNavigate) {
              console.log('Calling actual onNavigate function...');
              try {
                onNavigate(nodeId, nodeType);
                console.log('onNavigate call completed');
              } catch (error) {
                console.error('Error calling onNavigate:', error);
              }
            } else {
              console.log('onNavigate is undefined in GraphExplorer');
            }
          }}
        />
      )}

      {/* 간단한 필터 */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {nodeTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 노드 카드들 또는 관련 노드들 */}
      <div className="space-y-2">
        {isEdgesMode ? (
          // edges 모드: RelatedNodeCard들 표시
          (filteredItems as RagRelatedEdge[]).map((edge, index) => (
            <RelatedNodeCard
              key={index}
              edge={edge}
              onExpand={(nodeId, nodeType, nodeTitle) => handleExpandClick(nodeId, nodeType, { title: nodeTitle, meta: edge.node_meta })}
            />
          ))
        ) : (
          // 일반 모드: GraphNodeCard들과 관련 노드들 표시
          (filteredItems as RagSearchItem[]).map((item) => (
            <div key={item.node_id}>
              <GraphNodeCard
                item={item}
                isExpanded={expandedNodes.has(item.node_id)}
                onToggleExpand={() => toggleNodeExpansion(item.node_id)}
                onExpandNode={(nodeInfo) => handleExpandClick(item.node_id, item.node_type, nodeInfo)}
              />
              {/* 관련 노드들 표시 */}
              {item.related && item.related.length > 0 && expandedNodes.has(item.node_id) && (
                <div className="ml-4 mt-2 space-y-1">
                  {item.related.map((edge, edgeIndex) => (
                    <RelatedNodeCard
                      key={edgeIndex}
                      edge={edge}
                      onExpand={(nodeId, nodeType, nodeTitle) => handleExpandClick(nodeId, nodeType, { title: nodeTitle, meta: edge.node_meta })}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No results found.
        </div>
      )}
    </div>
  );
};  

export default GraphExplorer;
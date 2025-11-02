import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Expand } from 'lucide-react';
import { RagSearchItem } from '@/lib/api/generated';
import { NODE_TYPE_COLORS } from './shared/constants';
import { parseMetaInfo } from './shared/metaUtils';

interface GraphNodeCardProps {
  item: RagSearchItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onExpandNode: (nodeInfo: { title?: string; meta?: Record<string, any> }) => void;
}

const GraphNodeCard: React.FC<GraphNodeCardProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  onExpandNode
}) => {
  const nodeColor = NODE_TYPE_COLORS[item.node_type] || NODE_TYPE_COLORS.default;
  const hasRelated = (item.related || []).length > 0;
  const parsedMeta = item.meta ? parseMetaInfo(item.meta) : [];

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${nodeColor} text-xs px-2 py-0.5`}>
                {item.node_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {(item.score * 100).toFixed(1)}%
              </span>
            </div>
            <h3 className="font-medium text-sm leading-tight">
              {item.title || `${item.node_type} #${item.source_id}`}
            </h3>
            {item.summary && (
              <p className="text-xs text-muted-foreground mt-1 mb-2 overflow-hidden"
                 style={{
                   display: '-webkit-box',
                   WebkitLineClamp: 2,
                   WebkitBoxOrient: 'vertical' as const
                 }}>
                {item.summary}
              </p>
            )}

            {/* 메타 정보 표시 */}
            {parsedMeta.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {parsedMeta.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-xs">
                    {item.value}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-1 ml-3 shrink-0">
            {hasRelated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-7 w-7 p-0"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExpandNode({ title: item.title || undefined, meta: item.meta })}
              className="h-7 w-7 p-0"
            >
              <Expand className="h-3 w-3" />
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default GraphNodeCard;

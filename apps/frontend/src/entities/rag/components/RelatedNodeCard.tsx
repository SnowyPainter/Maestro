import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Expand } from 'lucide-react';
import { RagRelatedEdge } from '@/lib/api/generated';
import { NODE_TYPE_COLORS } from './shared/constants';
import { parseMetaInfo } from './shared/metaUtils';

interface RelatedNodeCardProps {
  edge: RagRelatedEdge;
  onExpand?: (nodeId: string, nodeType: string, nodeTitle?: string) => void;
}

const RelatedNodeCard: React.FC<RelatedNodeCardProps> = ({ edge, onExpand }) => {
  const nodeColor = NODE_TYPE_COLORS[edge.node_type || 'default'] || NODE_TYPE_COLORS.default;
  const parsedMeta = edge.node_meta ? parseMetaInfo(edge.node_meta) : [];

  return (
    <Card className="w-full">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              {edge.node_type && (
                <Badge className={`${nodeColor} text-xs px-1 py-0`}>
                  {edge.node_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-medium leading-tight mb-1">
              {edge.title || `Node ${edge.dst_node_id.slice(0, 8)}...`}
            </h4>
            {edge.summary && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {edge.summary}
              </p>
            )}

            {/* 메타 정보 표시 (summary 없어도 다른 정보 표시) */}
            {parsedMeta.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {parsedMeta.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-xs">
                    {item.value}
                  </div>
                ))}
              </div>
            )}
          </div>

          {onExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExpand?.(edge.dst_node_id, edge.node_type || 'unknown', edge.title || undefined)}
              className="h-6 w-6 p-0 shrink-0 mt-1"
            >
              <Expand className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RelatedNodeCard;

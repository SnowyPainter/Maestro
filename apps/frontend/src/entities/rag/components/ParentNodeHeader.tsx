import React from 'react';
import { Badge } from '@/components/ui/badge';
import { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from './shared/constants';
import { parseMetaInfo } from './shared/metaUtils';

interface ParentNode {
  nodeId: string;
  nodeType: string;
  title?: string;
  meta?: Record<string, any>;
}

interface ParentNodeHeaderProps {
  parentNode: ParentNode;
  onNavigate?: (nodeId: string, nodeType: string) => void;
}

const ParentNodeHeader: React.FC<ParentNodeHeaderProps> = ({ parentNode, onNavigate }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('ParentNodeHeader clicked:', parentNode.nodeId, parentNode.nodeType, !!onNavigate);
    if (onNavigate) {
      console.log('Calling onNavigate...');
      onNavigate(parentNode.nodeId, parentNode.nodeType);
    } else {
      console.log('onNavigate is undefined!');
    }
  };

  return (
    <div
      className={`bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 rounded-lg p-3 ${
        onNavigate ? 'cursor-pointer hover:bg-blue-500/20 transition-colors' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Badge className={`${NODE_TYPE_COLORS[parentNode.nodeType] || NODE_TYPE_COLORS.default} text-xs px-2 py-0.5 shadow-sm`}>
            {parentNode.nodeType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 mb-1">
            {parentNode.title || (NODE_TYPE_LABELS[parentNode.nodeType] || NODE_TYPE_LABELS.default)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Showing related nodes and connections
          </div>
          {/* 부모 노드 메타 정보 표시 */}
          {parentNode.meta && (
            <div className="flex gap-1 flex-wrap mt-2">
              {parseMetaInfo(parentNode.meta).slice(0, 2).map((item, idx) => (
                <div key={idx} className="text-xs">
                  {item.value}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-blue-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ParentNodeHeader;

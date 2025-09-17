import { useState } from "react";
import { Message } from "@/entities/messages/context/ChatMessagesContext";

const MAX_MESSAGE_LENGTH = 500;

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (content === null || content === undefined) {
      return '';
    }
    if (typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch {
        return String(content);
      }
    }
    return String(content);
  };
  
  if (typeof message.content === 'object' && message.content !== null && '$$typeof' in message.content) {
    return (
      <div className="w-full">
        {message.content}
      </div>
    );
  }

  const content = formatContent(message.content);
  const shouldTruncate = content.length > MAX_MESSAGE_LENGTH;
  const displayContent = shouldTruncate && !isExpanded
    ? content.slice(0, MAX_MESSAGE_LENGTH) + '...'
    : content;

  const handleToggle = () => {
    if (shouldTruncate) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`p-3 rounded-2xl shadow-sm max-w-lg ${
        shouldTruncate ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      } ${
        message.type === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-card-foreground border'
      }`}
      onClick={handleToggle}
    >
      <div
        className={`whitespace-pre-wrap break-words ${
          shouldTruncate && !isExpanded ? 'max-h-32 overflow-hidden' : ''
        }`}
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        {displayContent}
        {shouldTruncate && (
          <div className="mt-2 pt-2 border-t border-current border-opacity-20">
            <button
              className="text-xs opacity-70 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? 'Fold' : 'Expand'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

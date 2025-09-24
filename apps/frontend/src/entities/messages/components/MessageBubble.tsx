import React, { useState } from "react";
import { Message } from "@/entities/messages/context/ChatMessagesContext";
import { parseClauses } from "@/lib/chat/parse";
import { ChipComponent } from "@/components/Chat/Chip";
import { SlotHintItem } from "@/lib/api/generated";
import { useListSlotHintsApiOrchestratorHelpersSlotHintsGet } from "@/lib/api/generated";

const MAX_MESSAGE_LENGTH = 500;

interface MessageBubbleProps {
  message: Message;
  hintMap?: Record<string, SlotHintItem>;
}

export function MessageBubble({ message, hintMap }: MessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get hint map if not provided
  const { data: hintMapData } = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({
    query: undefined,
    limit: 100
  }, {
    query: {
      enabled: !hintMap
    }
  });
  const actualHintMap = hintMap || hintMapData?.reduce((acc, hint) => {
    acc[hint.name] = hint;
    return acc;
  }, {} as Record<string, SlotHintItem>) || {};

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

  const renderContent = (content: string) => {
    const clauses = parseClauses(content);
    if (clauses.length === 0) {
      return content;
    }

    const parts: React.ReactElement[] = [];
    let lastIndex = 0;

    clauses.forEach((clause, index) => {
      // Add text before the chip
      if (clause.span[0] > lastIndex) {
        const textPart = content.slice(lastIndex, clause.span[0]);
        if (textPart) {
          parts.push(
            <span key={`text-${index}`}>{textPart}</span>
          );
        }
      }

      // Add the chip
      const chip = {
        id: `chip-${clause.slot}-${clause.value}-${index}`,
        slot: clause.slot,
        value: clause.value
      };
      parts.push(
        <ChipComponent
          key={`chip-${clause.slot}-${clause.value}-${index}`}
          chip={chip}
          hintMap={actualHintMap}
          variant="message"
        />
      );

      lastIndex = clause.span[1];
    });

    // Add remaining text after the last chip
    if (lastIndex < content.length) {
      const textPart = content.slice(lastIndex);
      if (textPart) {
        parts.push(
          <span key={`text-end`}>{textPart}</span>
        );
      }
    }

    return parts;
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
  const truncatedContent = shouldTruncate && !isExpanded
    ? content.slice(0, MAX_MESSAGE_LENGTH) + '...'
    : content;

  // Render content with chips if it's a string, otherwise use formatted content
  const contentToRender = typeof message.content === 'string'
    ? renderContent(truncatedContent)
    : truncatedContent;

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
        {contentToRender}
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

import React from 'react';
import { SlotHintItem } from "@/lib/api/generated";
import { ContextValueItem } from "@/store/chat-context-registry";

interface SuggestProps {
  suggestions: (SlotHintItem | ContextValueItem)[];
  highlightIndex: number;
  onSelect: (suggestion: SlotHintItem | ContextValueItem) => void;
  suggestionRefs: React.MutableRefObject<(HTMLLIElement | null)[]>;
  style: React.CSSProperties;
}

export const Suggest: React.FC<SuggestProps> = ({ suggestions, highlightIndex, onSelect, suggestionRefs, style }) => {
  const hasContent = suggestions.length > 0;

  return (
    <div 
      className="absolute mb-2 w-96 rounded-xl border bg-background shadow-lg z-10 overflow-hidden"
      style={style}
    >
      {!hasContent ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          No suggestions found
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const active = index === highlightIndex;
            const isSlotHint = 'name' in suggestion;
            const isContextValue = 'value' in suggestion;

            return (
              <li
                key={isSlotHint ? suggestion.name : isContextValue ? suggestion.value : index}
                ref={(el) => {
                  if (suggestionRefs.current) {
                    suggestionRefs.current[index] = el;
                  }
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${active ? "bg-muted" : "bg-background"}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(suggestion);
                }}
              >
                {isSlotHint ? (
                  <>
                    <div className="font-medium">{suggestion.label}</div>
                    {suggestion.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{suggestion.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">@{suggestion.name}</div>
                  </>
                ) : isContextValue ? (
                  <>
                    <div className="font-medium">{suggestion.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{suggestion.value}</div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

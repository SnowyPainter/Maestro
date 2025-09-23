// components/chat/Overlay.tsx
import { Clause } from "@/lib/chat/parse";
import { resolveChipDisplay } from "@/lib/chat/labels";
import { SlotHintItem } from "@/lib/api/generated";
import React, { useLayoutEffect, useRef, useState } from "react";
import { icons } from "lucide-react";

const DynamicIcon = ({ name }: { name: string }) => {
  const Icon = (icons as Record<string, React.FC<any>>)[name];
  if (Icon) {
    return <Icon className="w-3 h-3" aria-hidden="true" />;
  }
  return <span aria-hidden="true">{name}</span>;
};

const renderContent = (
  value: string,
  clauses: Clause[],
  hintMap: Record<string, SlotHintItem>,
  onChipClick?: (position: number) => void
) => {
  const parts: Array<React.JSX.Element | string> = [];
  let cursor = 0;

  for (const c of clauses) {
    const [s, e] = c.span;
    if (s > cursor) {
      parts.push(value.slice(cursor, s));
    }

    const disp = resolveChipDisplay(c.slot, c.value, hintMap);
    parts.push(
      <span key={`${s}-${e}`} className="align-baseline">
        <span
          className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs mr-1 cursor-text"
          onClick={() => onChipClick?.(e)}
        >
          {disp.icon && <DynamicIcon name={disp.icon} />}
          <span className="opacity-70">@</span>
          <span className="font-medium">{c.slot}</span>
          <span className="opacity-60">:</span>
          <span className="font-medium">{disp.label}</span>
        </span>
      </span>
    );
    cursor = e;
  }
  if (cursor < value.length) {
    parts.push(value.slice(cursor));
  }
  return parts;
};

export function ChatOverlay({
  value,
  clauses,
  hintMap,
  onChipClick,
  caretIndex,
}: {
  value: string;
  clauses: Clause[];
  hintMap: Record<string, SlotHintItem>;
  onChipClick?: (position: number) => void;
  caretIndex: number;
}) {
  const [caretRect, setCaretRect] = useState<{ top: number; left: number } | null>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const visualParts = renderContent(value, clauses, hintMap, onChipClick);
  const measureParts = renderContent(value.slice(0, caretIndex), clauses, hintMap);

  useLayoutEffect(() => {
    if (markerRef.current && containerRef.current) {
      const markerNode = markerRef.current;
      const containerNode = containerRef.current;
      const markerRect = markerNode.getBoundingClientRect();
      const containerRect = containerNode.getBoundingClientRect();
      setCaretRect({
        top: markerRect.top - containerRect.top,
        left: markerRect.left - containerRect.left,
      });
    }
  }, [value, caretIndex, clauses, hintMap]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words p-3 pr-24"
    >
      {/* Visible content */}
      {visualParts}

      {/* Custom Caret */}
      {caretRect && (
        <div
          className="custom-caret"
          style={{
            position: 'absolute',
            top: `${caretRect.top}px`,
            left: `${caretRect.left}px`,
          }}
        />
      )}

      {/* Hidden measurement div */}
      <div className="absolute top-0 left-0 invisible">
        <div className="whitespace-pre-wrap break-words p-3 pr-24">
          {measureParts}
          <span ref={markerRef} />
        </div>
      </div>
    </div>
  );
}
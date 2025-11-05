import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

import { ScheduleSegment } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

const TOTAL_MINUTES = 24 * 60;
const SNAP_MINUTES = 15;
const MIN_SEGMENT_MINUTES = SNAP_MINUTES;

type EditorSegment = ScheduleSegment & { __internalId: string };

type DragState =
  | { type: "create"; origin: number; current: number }
  | { type: "resize"; segmentId: string; edge: "start" | "end" };

const clampMinutes = (value: number) => Math.min(Math.max(value, 0), TOTAL_MINUTES);
const snapMinutes = (value: number) => Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;

const timeToMinutes = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
  const clamped = clampMinutes(minutes);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
};

const createInternalId = () => `segment-${Math.random().toString(36).slice(2, 10)}`;

export function TimeSegmentEditor({
  value = [],
  onChange,
  label = "Time Segments",
  error,
}: {
  value: ScheduleSegment[];
  onChange: (segments: ScheduleSegment[]) => void;
  label?: string;
  error?: string;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [segments, setSegments] = useState<EditorSegment[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);

  const normalizeSegments = useCallback((items: ScheduleSegment[]): EditorSegment[] => {
    return items
      .map((segment, index) => {
        const internalId =
          (segment as unknown as EditorSegment).__internalId ||
          segment.id ||
          `segment-${index}-${segment.start}-${segment.end}`;

        return {
          ...segment,
          id: segment.id || internalId,
          count_per_day: segment.count_per_day ?? 1,
          __internalId: internalId,
        } as EditorSegment;
      })
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, []);

  useEffect(() => {
    setSegments(normalizeSegments(value));
  }, [value, normalizeSegments]);

  const updateSegments = useCallback(
    (updater: (prev: EditorSegment[]) => EditorSegment[]) => {
      setSegments((prev) => {
        const next = updater(prev);
        const sorted = [...next].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
        onChange(
          sorted.map(({ __internalId, ...rest }) => ({
            ...rest,
            count_per_day: rest.count_per_day ?? 1,
          }))
        );
        return sorted;
      });
    },
    [onChange]
  );

  const getMinutesFromClientX = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const relative = clampMinutes(((clientX - rect.left) / Math.max(rect.width, 1)) * TOTAL_MINUTES);
      return snapMinutes(relative);
    },
    []
  );

  const handleBarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const minutes = getMinutesFromClientX(event.clientX);
    setDragState({ type: "create", origin: minutes, current: minutes });
    setDraft({ start: minutes, end: minutes });
  };

  const handleDeleteSegment = (segmentId: string) => {
    updateSegments((prev) => prev.filter((segment) => segment.__internalId !== segmentId));
  };

  const handleCountChange = (segmentId: string, value: number) => {
    const nextCount = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    updateSegments((prev) =>
      prev.map((segment) =>
        segment.__internalId === segmentId
          ? {
              ...segment,
              count_per_day: nextCount,
            }
          : segment
      )
    );
  };

  const handleResizeMouseDown = (
    segmentId: string,
    edge: "start" | "end"
  ) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragState({ type: "resize", segmentId, edge });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (event: MouseEvent) => {
      const minutes = getMinutesFromClientX(event.clientX);

      if (dragState.type === "create") {
        setDraft({ start: dragState.origin, end: minutes });
        setDragState((prev) =>
          prev && prev.type === "create"
            ? {
                ...prev,
                current: minutes,
              }
            : prev
        );
      }

      if (dragState.type === "resize") {
        updateSegments((prev) =>
          prev.map((segment) => {
            if (segment.__internalId !== dragState.segmentId) return segment;

            const startMinutes = timeToMinutes(segment.start);
            const endMinutes = timeToMinutes(segment.end);

            if (dragState.edge === "start") {
              const nextStart = Math.min(
                snapMinutes(minutes),
                endMinutes - MIN_SEGMENT_MINUTES
              );
              const boundedStart = clampMinutes(nextStart);
              return {
                ...segment,
                start: minutesToTime(Math.min(boundedStart, endMinutes - MIN_SEGMENT_MINUTES)),
              };
            }

            const nextEnd = Math.max(
              snapMinutes(minutes),
              startMinutes + MIN_SEGMENT_MINUTES
            );
            const boundedEnd = clampMinutes(nextEnd);
            return {
              ...segment,
              end: minutesToTime(Math.max(boundedEnd, startMinutes + MIN_SEGMENT_MINUTES)),
            };
          })
        );
      }
    };

    const handleMouseUp = () => {
      if (dragState.type === "create" && draft) {
        const rawStart = Math.min(dragState.origin, dragState.current);
        const rawEnd = Math.max(dragState.origin, dragState.current);
        const snappedStart = Math.min(
          snapMinutes(rawStart),
          rawEnd - MIN_SEGMENT_MINUTES
        );
        const snappedEnd = Math.max(
          snapMinutes(rawEnd),
          snappedStart + MIN_SEGMENT_MINUTES
        );

        const start = clampMinutes(snappedStart);
        const end = clampMinutes(snappedEnd);

        if (end - start >= MIN_SEGMENT_MINUTES) {
          const internalId = createInternalId();
          updateSegments((prev) => [
            ...prev,
            {
              id: internalId,
              start: minutesToTime(start),
              end: minutesToTime(end),
              count_per_day: 1,
              __internalId: internalId,
            },
          ]);
        }
      }

      setDragState(null);
      setDraft(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, draft, getMinutesFromClientX, updateSegments]);

  const timelineMarks = useMemo(() => [0, 360, 720, 1080, 1440], []);

  const draftVisual = draft
    ? {
        start: Math.min(draft.start, draft.end),
        end: Math.max(draft.start, draft.end),
      }
    : null;

  return (
    <div className="space-y-4">
      {label ? <Label>{label}</Label> : null}
      <div className="space-y-2">
        <div
          ref={barRef}
          className="relative h-14 w-full select-none rounded-md border border-border bg-muted"
          onMouseDown={handleBarMouseDown}
        >
          {segments.map((segment) => {
            const startMinutes = timeToMinutes(segment.start);
            const endMinutes = timeToMinutes(segment.end);
            const width = Math.max(endMinutes - startMinutes, MIN_SEGMENT_MINUTES);
            const leftPercent = (startMinutes / TOTAL_MINUTES) * 100;
            const widthPercent = (width / TOTAL_MINUTES) * 100;

            return (
              <div
                key={segment.__internalId}
                className={cn(
                  "absolute top-1 bottom-1 rounded-md border border-primary/60 bg-primary/70 text-primary-foreground transition-all",
                  hoverId === segment.__internalId && "shadow-lg ring-2 ring-primary/60"
                )}
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                onMouseEnter={() => setHoverId(segment.__internalId)}
                onMouseLeave={() => setHoverId((prev) => (prev === segment.__internalId ? null : prev))}
              >
                {hoverId === segment.__internalId && (
                  <>
                    <button
                      type="button"
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize rounded-l-md bg-primary-foreground/40 transition hover:bg-primary-foreground/60"
                      onMouseDown={handleResizeMouseDown(segment.__internalId, "start")}
                      aria-label="Adjust segment start"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize rounded-r-md bg-primary-foreground/40 transition hover:bg-primary-foreground/60"
                      onMouseDown={handleResizeMouseDown(segment.__internalId, "end")}
                      aria-label="Adjust segment end"
                    />
                    <button
                      type="button"
                      className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/90"
                      onClick={() => handleDeleteSegment(segment.__internalId)}
                      aria-label="Delete segment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-xs font-medium">
                  {segment.start.slice(0, 5)} – {segment.end.slice(0, 5)}
                </div>
              </div>
            );
          })}

          {draftVisual && (
            <div
              className="pointer-events-none absolute top-1 bottom-1 rounded-md border-2 border-dashed border-primary/50 bg-primary/20"
              style={{
                left: `${(draftVisual.start / TOTAL_MINUTES) * 100}%`,
                width: `${((draftVisual.end - draftVisual.start) / TOTAL_MINUTES) * 100}%`,
              }}
            />
          )}

          <div className="absolute inset-x-3 bottom-0 translate-y-full select-none text-[10px] text-muted-foreground">
            <div className="flex justify-between">
              {timelineMarks.map((minute) => (
                <span key={minute}>{minutesToTime(minute).slice(0, 5)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {segments.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {segments.map((segment) => (
            <div
              key={`details-${segment.__internalId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm"
            >
              <div className="font-medium">
                {segment.start.slice(0, 5)} – {segment.end.slice(0, 5)}
              </div>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Runs per day"
                className="h-8 w-16 text-center text-xs font-semibold sm:text-sm"
                value={segment.count_per_day ?? 1}
                onChange={(event) => handleCountChange(segment.__internalId, parseInt(event.target.value, 10))}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Drag across the timeline to create your first segment.
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

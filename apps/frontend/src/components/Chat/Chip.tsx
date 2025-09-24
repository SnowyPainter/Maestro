import React from "react";
import { icons } from "lucide-react";
import { resolveChipDisplay } from "@/lib/chat/labels";

// Using `any` for hintMap to match existing code until proper types are available.
type HintMap = any;

export interface Chip {
  id: string;
  slot: string;
  value: string;
}

const DynamicIcon = ({ name }: { name: string }) => {
  const Icon = (icons as Record<string, React.FC<any>>)[name];
  return Icon ? <Icon className="w-3 h-3" aria-hidden="true" /> : null;
};

/**
 * Returns the display text for a chip, e.g., "@persona:John Doe"
 */
export const getChipDisplayText = (chip: Chip, hintMap: HintMap): string => {
    const disp = resolveChipDisplay(chip.slot, chip.value, hintMap);
    return `@${chip.slot}:${disp.label}`;
};

/**
 * Renders a Chip for use within a contentEditable context.
 * It does NOT use contentEditable=false, relying on parent logic to prevent editing.
 * Its textContent is guaranteed to match getChipDisplayText().
 */
export const ChipComponent = React.memo(({ chip, hintMap }: { chip: Chip, hintMap: HintMap }) => {
  const disp = resolveChipDisplay(chip.slot, chip.value, hintMap);
  return (
    <span
      data-chip-id={chip.id}
      data-part-type="chip"
      className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs align-baseline"
    >
      {disp.icon && <DynamicIcon name={disp.icon} />}
      <span className="opacity-70">@</span>
      <span className="font-medium">{chip.slot}</span>
      <span className="opacity-60">:</span>
      <span className="font-medium">{disp.label}</span>
    </span>
  );
});
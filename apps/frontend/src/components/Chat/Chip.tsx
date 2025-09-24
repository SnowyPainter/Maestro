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
export const ChipComponent = React.memo(({
  chip,
  hintMap,
  variant = 'default'
}: {
  chip: Chip,
  hintMap: HintMap,
  variant?: 'default' | 'message'
}) => {
  const disp = resolveChipDisplay(chip.slot, chip.value, hintMap);

  const getVariantClasses = () => {
    switch (variant) {
      case 'message':
        return "inline-flex items-center gap-1 rounded-full bg-gray-400 bg-opacity-70 backdrop-blur-sm text-white px-2 py-0.5 text-xs align-baseline border border-gray-500 border-opacity-40";
      default:
        return "inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs align-baseline";
    }
  };

  return (
    <span
      data-chip-id={chip.id}
      data-part-type="chip"
      className={getVariantClasses()}
    >
      {disp.icon && <DynamicIcon name={disp.icon} />}
      <span className="opacity-70">@</span>
      <span className="font-medium">{chip.slot}</span>
      <span className="opacity-60">:</span>
      <span className="font-medium">{disp.label}</span>
    </span>
  );
});
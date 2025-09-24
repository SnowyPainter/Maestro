import React from "react";
import { Button } from "@/components/ui/button";
import { Send, icons } from "lucide-react";
import { resolveChipDisplay } from "@/lib/chat/labels";

interface Chip {
  id: string;
  slot: string;
  value: string;
}

const DynamicIcon = ({ name }: { name: string }) => {
  const Icon = (icons as Record<string, React.FC<any>>)[name];
  return Icon ? <Icon className="w-3 h-3" aria-hidden="true" /> : null;
};

export const ChipComponent = React.memo(({ chip, hintMap }: { chip: Chip, hintMap: any }) => {
  const disp = resolveChipDisplay(chip.slot, chip.value, hintMap);
  return (
    <span
      contentEditable={false}
      data-chip-id={chip.id}
      className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
    >
      {disp.icon && <DynamicIcon name={disp.icon} />}
      <span className="opacity-70">@</span>
      <span className="font-medium">{chip.slot}</span>
      <span className="opacity-60">:</span>
      <span className="font-medium">{disp.label}</span>
    </span>
  );
});

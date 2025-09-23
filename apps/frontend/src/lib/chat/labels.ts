// lib/chat/labels.ts
import { SlotHintItem } from "../api/generated";
import { ContextValueItem, useContextRegistryStore, SLOT_ICONS } from "@/store/chat-context-registry";

/*
slot은 서버에서 가져오기
value는 레지스트리에서 가져오기(있을 수도, 없을 수도)
*/

export function resolveChipDisplay(slot: string, value: string, hints?: Record<string, SlotHintItem>) {
  // 1) 레지스트리에서 매칭
  const fromReg = useContextRegistryStore.getState().getValues(slot)
    .find((v: ContextValueItem) => v.value === value);
  if (fromReg) return { label: fromReg.label, icon: fromReg.icon };

  const hint = hints?.[slot];
  const choiceHit = hint?.choices?.find(c => c === value);
  if (choiceHit) return { label: choiceHit, icon: SLOT_ICONS[slot] || SLOT_ICONS.default };

  // 3) default: raw value
  return { label: value, icon: SLOT_ICONS[slot] || SLOT_ICONS.default };
}

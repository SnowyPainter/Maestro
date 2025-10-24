// store/context-registry.ts
import { create } from "zustand";

export type ContextValueItem = {
  value: string;        // 실제 내부 값 (예: "3")
  label: string;        // Chip에 보일 라벨 (예: "개발팀 계정")
  icon?: string;        // lucide 이름
  meta?: Record<string, any>;
};

// Slot key에 따른 기본 아이콘 매핑
export const SLOT_ICONS: Record<string, string> = {
  // Account related
  account: "User",
  account_id: "User",
  account_persona_id: "User",

  // Campaign related
  campaign_id: "Target",

  // Platform/Social
  platform: "Smartphone",

  // Content types
  content_kind: "Image",

  // Search/Filter
  q: "Search",
  limit: "Hash",
  offset: "SkipForward",

  // Time related
  since: "Calendar",
  until: "Calendar",
  as_of: "Clock",

  // Draft/Content
  draft_id: "FileText",
  variant_id: "FileText",
  post_publication_id: "Send",

  // Comments
  comment_id: "MessageSquare",

  // Persona/Account
  persona_id: "User",
  persona_account_id: "User",

  // Reactive
  template_id: "BookTemplate",

  // Location
  country: "MapPin",

  // Status/Filter
  status: "Filter",
  ready: "CheckCircle",

  // Default
  default: "Tag",
};

type RegistryState = {
  byKey: Record<string, ContextValueItem[]>;
  registerEmission: (key: string, item: ContextValueItem) => void;
  getValues: (key: string) => ContextValueItem[];
  clearKey: (key: string) => void;
};

export const useContextRegistryStore = create<RegistryState>((set, get) => ({
  byKey: {},
  registerEmission: (key, item) => {
    const cur = get().byKey[key] ?? [];
    // 기본 아이콘 설정 (이미 아이콘이 있으면 유지)
    const itemWithIcon = {
      ...item,
      icon: item.icon || SLOT_ICONS[key] || SLOT_ICONS.default,
    };
    // label/value 기준 중복 제거 + 최신이 앞으로
    const next = [itemWithIcon, ...cur.filter(v => v.value !== item.value)];
    set({ byKey: { ...get().byKey, [key]: next.slice(0, 50) } });
  },
  getValues: (key) => get().byKey[key] ?? [],
  clearKey: (key) => set((s) => {
    const { [key]: _, ...rest } = s.byKey;
    return { byKey: rest };
  }),
}));

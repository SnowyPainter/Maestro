import { PlatformKind } from "@/lib/api/generated";

export type RenderedMediaItem = {
  type: "image" | "video";
  url: string;
  alt?: string;
  caption?: string;
  ratio?: string;
};

export type RenderedVariantBlocks = {
  media?: RenderedMediaItem[];
  options?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
};

export type DraftVariantRender = {
  variant_id: number;
  draft_id: number;
  platform: PlatformKind | string;
  status: string;
  compiled_at?: string;
  rendered_caption?: string | null;
  rendered_blocks?: RenderedVariantBlocks | null;
  warnings?: string[] | null;
  errors?: string[] | null;
  metrics?: Record<string, unknown> | null;
  compiler_version: number;
  ir_revision_compiled?: number | null;
};

export type PlatformPresentation = {
  label: string;
  badgeClass: string;
  accentClass: string;
};

export const platformPresentation: Record<PlatformKind, PlatformPresentation> = {
  [PlatformKind.instagram]: {
    label: "Instagram",
    badgeClass: "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
    accentClass: "border-pink-300/40",
  },
  [PlatformKind.threads]: {
    label: "Threads",
    badgeClass: "bg-gray-900 text-white",
    accentClass: "border-gray-300/40",
  },
  [PlatformKind.x]: {
    label: "X",
    badgeClass: "bg-sky-500 text-white",
    accentClass: "border-sky-300/40",
  },
  [PlatformKind.blog]: {
    label: "Blog",
    badgeClass: "bg-orange-500 text-white",
    accentClass: "border-orange-300/40",
  },
};

export function ensurePlatformKind(value: string | PlatformKind): PlatformKind | null {
  if (Object.values(PlatformKind).includes(value as PlatformKind)) {
    return value as PlatformKind;
  }
  return null;
}

export function formatCompiledAt(value?: string | null) {
  if (!value) return "Not compiled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function countListItems(items?: string[] | null) {
  return Array.isArray(items) ? items.length : 0;
}


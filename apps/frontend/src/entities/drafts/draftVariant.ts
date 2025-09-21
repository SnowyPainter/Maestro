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
  }
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
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function countListItems(items?: string[] | null) {
  return Array.isArray(items) ? items.length : 0;
}

export function formatOptionValue(value: unknown, maxLength = 100): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const str = String(value);
    return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const preview = value.slice(0, 3).map(item =>
      typeof item === 'object' && item !== null ? '[Object]' : String(item)
    ).join(', ');
    const suffix = value.length > 3 ? ` (+${value.length - 3} more)` : '';
    return `[${preview}${suffix}]`;
  }

  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2);
      return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
    } catch {
      return '[Complex Object]';
    }
  }

  return String(value);
}



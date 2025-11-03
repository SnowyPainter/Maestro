// src/lib/api/fetcher.ts
import { useSessionStore } from '@/store/session';
import { usePersonaContextStore } from '@/store/persona-context';

export type ApiFetchOptions = RequestInit & {
  baseUrl?: string;
  params?: Record<string, any>; // ★ 쿼리스트링 파라미터
};

export type ApiFetchInit = { url: string; data?: any } & ApiFetchOptions;

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

/** 값 필터링 + 배열/Date/boolean/number 안전 직렬화 */
function toSearchParams(input?: Record<string, any>): string {
  if (!input) return '';
  const sp = new URLSearchParams();

  const append = (key: string, value: any) => {
    if (value === undefined || value === null) return;
    if (value instanceof Date) {
      // 날짜는 YYYY-MM-DD로(필요 시 ISO 전체로 변경)
      sp.append(key, value.toISOString().slice(0, 10));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(v => append(key, v));
      return;
    }
    sp.append(key, String(value));
  };

  for (const [k, v] of Object.entries(input)) append(k, v);

  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** BASE + path 합치기 (//, /api 중복 방지) */
function joinBaseAndPath(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  // 슬래시 정규화
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/** body가 JSON인지 여부 판단 (FormData/Blob/ArrayBuffer 등은 그대로) */
function normalizeBody(data: any): { body?: BodyInit; contentType?: string } {
  if (data === undefined || data === null) return {};

  // FormData, Blob, ArrayBuffer 등은 Content-Type 자동 설정 방해하지 않음
  if (
    typeof FormData !== 'undefined' && data instanceof FormData ||
    typeof Blob !== 'undefined' && data instanceof Blob ||
    data instanceof ArrayBuffer
  ) {
    return { body: data };
  }

  return {
    body: JSON.stringify(data),
    contentType: 'application/json',
  };
}

export async function apiFetch<T = unknown>(
  init: ApiFetchInit,
  override?: ApiFetchOptions
): Promise<T> {
  // 1) init + override 병합 (override 우선)
  const merged: ApiFetchInit = { ...init, ...(override || {}) };

  const {
    url,
    data,                     // JSON 바디 등
    baseUrl,
    params: paramsFromMerged, // orval이 넘겨주는 쿼리 파라미터
    headers: hdrs,
    method,
    ...rest
  } = merged;

  // 2) params는 init/override 양쪽에서 올 수 있으니 최종 병합
  const params = {
    ...(init.params || {}),
    ...(override?.params || {}),
    ...(paramsFromMerged || {}),
  };

  // 3) BASE 조합 및 쿼리스트링 생성
  const base = baseUrl ?? BASE;
  const fullBasePath = joinBaseAndPath(base, url);
  const qs = toSearchParams(params);
  const fullUrl = `${fullBasePath}${qs}`;

  // 4) 헤더 구성
  const headers = new Headers(hdrs || {});
  const token = useSessionStore.getState().token || '';
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Request-ID', crypto.randomUUID());

  const {
    personaAccountId,
    draftId,
    draftEnabled,
    campaignId,
    campaignEnabled,
  } = usePersonaContextStore.getState();

  if (personaAccountId !== null) {
    headers.set('X-Persona-Account-Id', String(personaAccountId));
  }

  if (draftEnabled && draftId !== null) {
    headers.set('X-Draft-Id', String(draftId));
  }

  if (campaignEnabled && campaignId !== null) {
    headers.set('X-Campaign-Id', String(campaignId));
  }

  const httpMethod = (method || 'GET').toUpperCase();
  const isUnsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(httpMethod);
  if (isUnsafe) headers.set('X-Idempotency-Key', crypto.randomUUID());

  // 5) Body 구성: GET/HEAD는 body 금지, 그 외는 data 우선
  let body: BodyInit | undefined;
  if (!/^(GET|HEAD)$/i.test(httpMethod)) {
    const { body: normalized, contentType } = normalizeBody(
      data !== undefined ? data : (merged as any).body
    );
    body = normalized;
    if (contentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', contentType);
    }
  } else {
    // GET/HEAD에서 Content-Type 강제 설정 방지
    headers.delete('Content-Type');
  }

  // 6) fetch 호출
  const res = await fetch(fullUrl, {
    method: httpMethod,
    headers,
    body,
    // 필요 시 credentials 정책 조정
    // credentials: 'include',
    ...rest,
  });

  // 7) 본문 없는 응답 처리
  if ([204, 205, 304].includes(res.status)) return null as T;

  // 8) JSON 파싱 시도
  let parsed: unknown = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON이 아니면 그대로 문자열 반환을 원하면 여기서 parsed = text 로 바꾸세요.
      parsed = null;
    }
  }

  // 9) 에러 처리
  if (!res.ok) {
    throw {
      name: 'ApiError',
      message: 'API error',
      status: res.status,
      data: parsed ?? text ?? null,
    };
  }

  return (parsed as T) ?? (null as T);
}

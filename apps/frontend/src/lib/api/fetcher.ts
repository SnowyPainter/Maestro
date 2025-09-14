export type ApiFetchOptions = RequestInit & { baseUrl?: string }

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function apiFetch<T = unknown>(
  init: { url: string; data?: any } & ApiFetchOptions,
  override?: ApiFetchOptions
): Promise<T> {
  // init + override 병합
  const { url, data, ...options } = { ...init, ...(override || {}) }

  const base = options.baseUrl ?? BASE
  const full = url.startsWith('http') ? url : `${base}${url}`

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  })

  // JWT + 공통 헤더
  const token = localStorage.getItem('jwt') || ''
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('X-Request-ID', crypto.randomUUID())
  if (options.method && /POST|PUT|PATCH|DELETE/i.test(options.method)) {
    headers.set('X-Idempotency-Key', crypto.randomUUID())
  }

  // body 직렬화
  let body: BodyInit | undefined = undefined;
  if (data !== undefined) {
    body = JSON.stringify(data)
  } else {
    body = options.body ?? undefined;
  }

  const res = await fetch(full, { ...options, headers, body })

  if ([204, 205, 304].includes(res.status)) return null as T

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }

  if (!res.ok) {
    throw {
      name: 'ApiError',
      message: 'API error',
      status: res.status,
      data: parsed,
    }
  }

  return parsed as T
}

import { API_URL } from '~/constants/env'
import { SESSION_WITH_LOGIN } from '~/constants/keys'

const requestUuid = createRequestUuid()

type ResponseEnvelope<T> = {
  code?: number | string
  data?: T
  error?: { code?: number | string; message?: string | string[] }
  meta?: {
    pagination?: unknown
  }
  message?: string | string[]
}

export async function postJson<TResponse, TData>(
  path: string,
  data: TData,
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

type QueryObject = Record<string, boolean | number | string | undefined>
type QueryValue =
  | Array<number | string>
  | QueryObject
  | boolean
  | number
  | string
  | undefined

export async function getJson<TResponse>(
  path: string,
  params?: Record<string, QueryValue>,
): Promise<TResponse> {
  return requestJson<TResponse>(withQuery(path, params), { method: 'GET' })
}

export async function requestJson<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: buildAdminRequestHeaders(init.headers),
  })

  const responseData = normalizeResponseData(
    camelcaseKeys(await readResponseData<TResponse>(response)),
  )

  if (isUnauthorizedResponse(response, responseData)) {
    handleUnauthorized()
  }

  if (!response.ok) {
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      response.statusText

    throw new Error(
      Array.isArray(message) ? message.join(', ') : message || 'Request failed',
    )
  }

  if (responseData && 'data' in responseData) {
    if (responseData.meta?.pagination) {
      return {
        data: responseData.data,
        pagination: responseData.meta.pagination,
      } as TResponse
    }

    return responseData.data as TResponse
  }

  return responseData as TResponse
}

export async function requestBlob(
  path: string,
  init: RequestInit = {},
): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: buildAdminRequestHeaders(init.headers),
  })

  if (!response.ok) {
    const responseData = normalizeResponseData(
      camelcaseKeys(await readResponseData<unknown>(response.clone())),
    )

    if (isUnauthorizedResponse(response, responseData)) {
      handleUnauthorized()
    }

    const message =
      responseData?.error?.message ||
      responseData?.message ||
      response.statusText

    throw new Error(
      Array.isArray(message) ? message.join(', ') : message || 'Request failed',
    )
  }

  return response.blob()
}

export function buildAdminRequestHeaders(headers?: HeadersInit) {
  const next = new Headers(headers)
  next.set('x-skip-translation', '1')
  next.set('x-uuid', requestUuid)

  return next
}

function createRequestUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (char) => {
    const value = (Math.random() * 16) | 0
    const digit = char === 'x' ? value : (value & 0x3) | 0x8

    return digit.toString(16)
  })
}

function isUnauthorizedResponse<TResponse>(
  response: Response,
  responseData: null | ResponseEnvelope<TResponse>,
) {
  return (
    response.status === 401 ||
    responseData?.code === 401 ||
    responseData?.error?.code === 401 ||
    responseData?.error?.code === 'AUTH_NOT_LOGGED_IN'
  )
}

function handleUnauthorized() {
  sessionStorage.removeItem(SESSION_WITH_LOGIN)

  const current = `${window.location.pathname}${window.location.hash}`
  const hash = window.location.hash.replace(/^#/, '')
  const isAuthRoute =
    hash.startsWith('/login') ||
    hash.startsWith('/setup') ||
    hash.startsWith('/setup-api')

  if (isAuthRoute) return

  window.location.hash = `/login?from=${encodeURIComponent(
    hash || current || '/dashboard',
  )}`
}

export async function putJson<TResponse, TData>(
  path: string,
  data: TData,
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
    },
    method: 'PUT',
  })
}

export async function patchJson<TResponse, TData>(
  path: string,
  data: TData,
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
    },
    method: 'PATCH',
  })
}

export async function deleteJson<TResponse, TData = undefined>(
  path: string,
  data?: TData,
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    ...(data === undefined
      ? {}
      : {
          body: JSON.stringify(data),
          headers: {
            'content-type': 'application/json',
          },
        }),
    method: 'DELETE',
  })
}

function withQuery(path: string, params?: Record<string, QueryValue>) {
  if (!params) return path

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)))
      continue
    }
    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (childValue !== undefined) {
          searchParams.set(`${key}[${childKey}]`, String(childValue))
        }
      }
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()

  return query ? `${path}?${query}` : path
}

async function readResponseData<TResponse>(response: Response) {
  try {
    return (await response.json()) as ResponseEnvelope<TResponse>
  } catch {
    return null
  }
}

function camelcaseKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelcaseKeys(item)) as T
  }

  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      toCamelCase(key),
      camelcaseKeys(item),
    ]),
  ) as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function normalizeResponseData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeResponseData(item)) as T
  }

  if (!isPlainObject(value)) return value

  const next = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      normalizeResponseData(item),
    ]),
  )

  if ('totalPages' in next && !('totalPage' in next)) {
    next.totalPage = next.totalPages
  }
  if ('totalPage' in next && !('totalPages' in next)) {
    next.totalPages = next.totalPage
  }
  if ('page' in next && !('currentPage' in next)) {
    next.currentPage = next.page
  }
  if ('currentPage' in next && !('page' in next)) {
    next.page = next.currentPage
  }

  return next as T
}

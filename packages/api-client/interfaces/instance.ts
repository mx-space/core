/**
 * Subset of Next.js's `RequestInit['next']` augmentation, declared structurally
 * so the SDK does not pull in `next` as a runtime / type dependency. Adapters
 * that don't recognise it (axios, umi) will simply ignore the field.
 */
export interface NextFetchRequestConfig {
  revalidate?: number | false
  tags?: string[]
}

export interface RequestOptions {
  method?: string
  data?: Record<string, any>
  params?: Record<string, any> | URLSearchParams
  headers?: Record<string, string>
  transformResponse?: false | (<T = any>(data: any) => T)
  /**
   * Caching hint forwarded verbatim to the underlying adapter. Recognised by
   * the Next.js `fetch` / `ofetch` adapter for `revalidate` + cache `tags`;
   * other adapters drop it.
   */
  next?: NextFetchRequestConfig
  /**
   * Caching hint forwarded verbatim to the underlying adapter. Mirrors the
   * standard `RequestInit['cache']` enum.
   */
  cache?: 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload'

  [key: string]: any
}

export interface RequestOptions {
  method?: string
  data?: Record<string, any>
  params?: Record<string, any> | URLSearchParams
  headers?: Record<string, string>

  [key: string]: any
}

export interface RequestOptions {
  method?: string
  data?: Record<string, any>
  params?: Record<string, any> | URLSearchParams
  headers?: Record<string, string>
  transformResponse?: false | (<T = any>(data: any) => T)

  [key: string]: any
}

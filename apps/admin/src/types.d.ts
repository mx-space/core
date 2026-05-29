declare global {
  export interface Window {
    dialog: unknown
    injectData: {
      BASE_API: null | string
      WEB_URL: null | string
      GATEWAY: null | string
      LOGIN_BG: null | string
      TITLE: null | string

      INIT: null | boolean

      PAGE_PROXY: boolean
    }

    [K: string]: any
  }

  export const dialog: unknown

  export const __DEV__: boolean
  export type KV = Record<string, any>

  export type Class<T> = new (...args: any[]) => T
}

export {}

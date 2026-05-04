declare global {
  export type KV<T = any> = Record<string, T>

  export const isDev: boolean

  export const cwd: string
}

export {}

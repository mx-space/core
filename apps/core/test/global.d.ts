declare global {
  export type LegacyModelHandle<_T> = {
    model: any
  } & Record<string, any>
}

export {}

import type { Document, PaginateModel } from 'mongoose'

import '@mx-space/compiled/zx-global'

import type { ModelType } from '@typegoose/typegoose/lib/types'

declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ModelType<T> & PaginateModel<T & Document>

  export const isDev: boolean

  export const cwd: string
}

export {}

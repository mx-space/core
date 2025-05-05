import type { ModelType } from '@typegoose/typegoose/lib/types'
import type { Document, PaginateModel } from 'mongoose'

declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ModelType<T> & PaginateModel<T & Document>

  export const isDev: boolean

  export const cwd: string
}

export {}

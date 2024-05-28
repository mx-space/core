import type { Document, PaginateModel } from 'mongoose'
import type { WrappedConsola } from '@innei/pretty-logger-nestjs/lib/consola'

import 'vitest/globals'
import 'zx/globals'

import type { ModelType } from '@typegoose/typegoose/lib/types'

declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ModelType<T> & PaginateModel<T & Document>

  export const isDev: boolean

  export const consola: WrappedConsola
  export const cwd: string

  interface JSON {
    safeParse: typeof JSON.parse
  }
}

export {}

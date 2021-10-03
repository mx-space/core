import { ModelType } from '@typegoose/typegoose/lib/types'
import { Consola } from 'consola'
import { Document, PaginateModel } from 'mongoose'
import 'zx/globals'
declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ModelType<T> & PaginateModel<T & Document>

  export const isDev: boolean

  export const consola: Consola
}

export {}

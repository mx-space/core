import { ModelType } from '@typegoose/typegoose/lib/types'
import { Document, PaginateModel } from 'mongoose'
/// <reference types="../global" />
declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ModelType<T> & PaginateModel<T & Document>
}

export {}

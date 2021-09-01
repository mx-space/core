import { ReturnModelType } from '@typegoose/typegoose'
import { Document, PaginateModel } from 'mongoose'
declare global {
  export type KV<T = any> = Record<string, T>

  // @ts-ignore
  export type MongooseModel<T> = ReturnModelType<T> &
    PaginateModel<T & Document>
}

export {}

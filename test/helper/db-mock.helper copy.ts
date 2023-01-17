import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid/async'

import { getModelForClass } from '@typegoose/typegoose'
import {
  AnyParamConstructor,
  BeAnObject,
  IModelOptions,
  ReturnModelType,
} from '@typegoose/typegoose/lib/types'

let mongod: MongoMemoryServer

const dbMap = new Map<string, typeof mongoose>()
/**
 
 * Connect to mock memory db.
 */
const connect = async () => {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()

  const mongooseInstance = await mongoose.connect(uri, {
    autoIndex: true,
    maxPoolSize: 10,
  })
  const id = await nanoid()
  dbMap.set(id, mongooseInstance)
  return id
}

/**
 * Close db connection
 */
const closeDatabase = async (id: string) => {
  const mongoose = dbMap.get(id)
  if (!mongoose) {
    return
  }
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  dbMap.delete(id)
  if (dbMap.size === 0) await mongod.stop()
}

/**
 * Delete db collections
 */
const clearDatabase = async (id: string) => {
  const mongoose = dbMap.get(id)
  if (!mongoose) {
    return
  }
  const collections = mongoose.connection.collections

  for (const key in collections) {
    const collection = collections[key]
    await collection.deleteMany({})
  }
}

export const dbHelper = {
  connect,
  close: () => closeDatabase(),
  clear: () => clearDatabase(),

  getModel<U extends AnyParamConstructor<any>, QueryHelpers = BeAnObject>(
    cl: U,
    options?: IModelOptions,
  ): ReturnModelType<U, QueryHelpers> {
    return getModelForClass(cl, options)
  },
}

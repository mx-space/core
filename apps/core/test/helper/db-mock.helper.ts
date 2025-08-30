import { getModelForClass } from '@typegoose/typegoose'
import type {
  AnyParamConstructor,
  BeAnObject,
  IModelOptions,
  ReturnModelType,
} from '@typegoose/typegoose/lib/types'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongod: MongoMemoryServer

/**
 
 * Connect to mock memory db.
 */
const connect = async () => {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()

  return await mongoose.connect(uri, {
    autoIndex: true,
    maxPoolSize: 10,
  })
}

/**
 * Close db connection
 */
const closeDatabase = async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  await mongod.stop()
}

/**
 * Delete db collections
 */
const clearDatabase = async () => {
  const collections = mongoose.connection.collections

  for (const key in collections) {
    const collection = collections[key]
    await collection.deleteMany({})
  }
}

export const dbHelper = {
  connect,
  close: closeDatabase,
  clear: clearDatabase,

  getModel<U extends AnyParamConstructor<any>, QueryHelpers = BeAnObject>(
    cl: U,
    options?: IModelOptions,
  ): ReturnModelType<U, QueryHelpers> {
    return getModelForClass(cl, {
      existingMongoose: mongoose,
      existingConnection: mongoose.connection,
      ...options,
    })
  },
}

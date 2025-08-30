/**
 * @copy https://github.com/surmon-china/nodepress/blob/main/src/transformers/model.transformer.ts
 * @file Model transform & helper
 * @module transformer/model
 * @description 用于将一个基本的 Typegoose 模型转换为 Model 和 Provider，及模型注入器
 * @link https://github.com/kpfromer/nestjs-typegoose/blob/master/src/typegoose.providers.ts
 * @author Surmon <https://github.com/surmon-china>
 */

import type { Provider } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { getModelForClass } from '@typegoose/typegoose'
import {
  DB_CONNECTION_TOKEN,
  DB_MODEL_TOKEN_SUFFIX,
} from '~/constants/system.constant'
import type { Connection } from 'mongoose'

export interface TypegooseClass {
  new (...args: any[])
}

export function getModelToken(modelName: string): string {
  return modelName + DB_MODEL_TOKEN_SUFFIX
}

// Get Provider by Class
export function getProviderByTypegooseClass(
  typegooseClass: TypegooseClass,
): Provider {
  return {
    provide: getModelToken(typegooseClass.name),
    useFactory: (connection: Connection) =>
      getModelForClass(typegooseClass, { existingConnection: connection }),
    inject: [DB_CONNECTION_TOKEN],
  }
}

// Model injecter
export function InjectModel(model: TypegooseClass) {
  return Inject(getModelToken(model.name))
}

import LeanId from 'mongoose-lean-id'
import { default as mongooseLeanVirtuals } from 'mongoose-lean-virtuals'
import Paginate from 'mongoose-paginate-v2'

import { ApiHideProperty } from '@nestjs/swagger'
import { index, modelOptions, plugin } from '@typegoose/typegoose'

import { ImageModel } from './image.model'

@plugin(mongooseLeanVirtuals)
@plugin(Paginate)
@plugin(LeanId)
@modelOptions({
  schemaOptions: {
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
    timestamps: {
      createdAt: 'created',
      updatedAt: false,
    },
    versionKey: false,
  },
})
@index({ created: -1 })
@index({ created: 1 })
export class BaseModel {
  @ApiHideProperty()
  created?: Date

  @ApiHideProperty()
  id?: string

  static get protectedKeys() {
    return ['created', 'id', '_id']
  }
}

export type { ImageModel as TextImageRecordType }

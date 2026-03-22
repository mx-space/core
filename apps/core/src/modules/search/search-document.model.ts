import { index, modelOptions, prop } from '@typegoose/typegoose'

import { SEARCH_DOCUMENT_COLLECTION_NAME } from '~/constants/db.constant'

export type SearchDocumentRefType = 'post' | 'note' | 'page'

@index({ refType: 1, refId: 1 }, { unique: true })
@index({ title: 'text', searchText: 'text' })
@index({ terms: 1 })
@index({ refType: 1, modified: -1, created: -1 })
@index({ refType: 1, isPublished: 1, publicAt: 1, hasPassword: 1 })
@modelOptions({
  options: {
    customName: SEARCH_DOCUMENT_COLLECTION_NAME,
  },
})
export class SearchDocumentModel {
  @prop({ required: true, enum: ['post', 'note', 'page'] })
  refType!: SearchDocumentRefType

  @prop({ required: true, index: true })
  refId!: string

  @prop({ required: true, trim: true })
  title!: string

  @prop({ required: true, trim: true })
  searchText!: string

  @prop({ type: () => [String], default: [] })
  terms!: string[]

  @prop({ type: () => Object, default: {} })
  titleTermFreq!: Record<string, number>

  @prop({ type: () => Object, default: {} })
  bodyTermFreq!: Record<string, number>

  @prop({ default: 0 })
  titleLength!: number

  @prop({ default: 0 })
  bodyLength!: number

  @prop({ trim: true })
  slug?: string

  @prop()
  nid?: number

  @prop({ default: true })
  isPublished!: boolean

  @prop()
  publicAt?: Date | null

  @prop({ default: false })
  hasPassword!: boolean

  @prop()
  created?: Date | null

  @prop()
  modified?: Date | null
}

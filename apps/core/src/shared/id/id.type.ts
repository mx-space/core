declare const objectIdBrand: unique symbol
declare const entityIdBrand: unique symbol

export type ObjectIdString = string & {
  readonly [objectIdBrand]: 'ObjectIdString'
}

export type EntityId<Name extends string> = ObjectIdString & {
  readonly [entityIdBrand]: Name
}

export type PostId = EntityId<'post'>
export type NoteId = EntityId<'note'>
export type PageId = EntityId<'page'>
export type RecentlyId = EntityId<'recently'>
export type CommentId = EntityId<'comment'>
export type ReaderId = EntityId<'reader'>
export type CategoryId = EntityId<'category'>
export type TopicId = EntityId<'topic'>

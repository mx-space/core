/**
 * Polymorphic reference target types used across the data model. Stored in
 * `ref_type` columns on records that reference a Post, Note, Page, or Recently
 * row without a hard foreign key.
 */
export enum CollectionRefTypes {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Recently = 'recently',
}

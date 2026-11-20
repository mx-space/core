/**
 * Client-side mirror of `CollectionRefTypes`.
 *
 * The canonical declaration lives in the private, unpublished
 * `@mx-space/db-schema` workspace package. api-client is published, so its
 * bundled `.d.ts` cannot re-export that private module; the values are
 * duplicated here instead. `__tests__/ref-types.test.ts` fails if the two
 * declarations drift.
 */
export enum CollectionRefTypes {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Recently = 'recently',
}

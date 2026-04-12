import { Types } from 'mongoose'

import { OBJECT_ID_PATTERN, zObjectIdString } from './id.schema'
import type { EntityId, ObjectIdString } from './id.type'

type ObjectIdLike = Types.ObjectId | { toString: () => string }

export function isObjectIdString(value: unknown): value is ObjectIdString {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value)
}

export function parseObjectIdString(value: unknown): ObjectIdString {
  return zObjectIdString.parse(value)
}

export function unsafeObjectIdString(value: string): ObjectIdString {
  return value as ObjectIdString
}

export function brandEntityId<Name extends string>(
  id: ObjectIdString,
): EntityId<Name> {
  return id as EntityId<Name>
}

export function normalizeObjectIdString(value: string | ObjectIdLike) {
  if (typeof value === 'string') {
    return unsafeObjectIdString(value)
  }

  return unsafeObjectIdString(value.toString())
}

export function toObjectId(id: ObjectIdString): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TypeError(`Invalid ObjectId: ${id}`)
  }

  return new Types.ObjectId(id)
}

export function toObjectIdArray(ids: readonly ObjectIdString[]) {
  return ids.map((id) => toObjectId(id))
}

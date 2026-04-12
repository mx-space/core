import { z } from 'zod'

import type { ObjectIdString } from './id.type'

export const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i

export const zObjectIdString = z
  .string()
  .regex(OBJECT_ID_PATTERN, 'Invalid MongoDB ObjectId')
  .transform((value) => value as ObjectIdString)

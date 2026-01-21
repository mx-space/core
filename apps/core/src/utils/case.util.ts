import { isPlainObject } from 'es-toolkit/compat'
import snakecaseKeys from 'snakecase-keys'

type SnakeCaseKeysOptions = Parameters<typeof snakecaseKeys>[1]

function toPlainObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toPlainObject(item)) as T
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (isPlainObject(obj)) {
    return obj
  }

  if (typeof (obj as any).toJSON === 'function') {
    return (obj as any).toJSON()
  }

  if (typeof (obj as any).toObject === 'function') {
    return (obj as any).toObject()
  }

  const plain = {} as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    plain[key] = toPlainObject((obj as any)[key])
  }
  return plain as T
}

export function snakecaseKeysWithCompat<
  T extends Record<string, any> | readonly Record<string, any>[],
>(obj: T, options?: SnakeCaseKeysOptions): T {
  const plainObj = toPlainObject(obj)
  return snakecaseKeys(plainObj as any, options) as T
}

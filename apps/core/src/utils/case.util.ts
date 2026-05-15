import snakecaseKeys from 'snakecase-keys'

type SnakeCaseKeysOptions = Parameters<typeof snakecaseKeys>[1]

export function snakecaseKeysWithCompat<
  T extends Record<string, any> | readonly Record<string, any>[],
>(obj: T, options?: SnakeCaseKeysOptions): T {
  return snakecaseKeys(obj as any, options) as T
}

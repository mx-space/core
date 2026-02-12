import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

/**
 * Transform string query parameter to boolean
 * '1' or 'true' becomes true, all other values become false
 *
 * Note: This decorator is primarily used for query parameter transformation.
 * For Zod schemas, use z.preprocess() or z.coerce instead.
 */
export function transformBoolean(value: unknown): boolean {
  return value === '1' || value === 'true' || value === true
}

/**
 * @deprecated Use Zod schema with z.preprocess() instead
 * Example:
 * ```typescript
 * const schema = z.object({
 *   enabled: z.preprocess((val) => val === '1' || val === 'true', z.boolean())
 * })
 * ```
 */
export const TransformBoolean = createParamDecorator(
  (data: string, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest()
    const value = request.query?.[data] ?? request.body?.[data]
    return transformBoolean(value)
  },
)

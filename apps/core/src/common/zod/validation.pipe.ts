import { HttpStatus, StandardSchemaValidationPipe } from '@nestjs/common'

import { AppException, ErrorCodes } from '~/common/errors/exception.types'

type StandardPathSegment = PropertyKey | { readonly key: PropertyKey }

type StandardIssue = {
  readonly message: string
  readonly path?: ReadonlyArray<StandardPathSegment>
  readonly code?: string
}

export function standardIssuePath(
  issue: StandardIssue,
): Array<string | number> {
  return (issue.path ?? []).map((segment) => {
    if (typeof segment === 'object' && segment !== null && 'key' in segment) {
      const key = segment.key
      return typeof key === 'symbol' ? String(key) : key
    }
    return typeof segment === 'symbol' ? String(segment) : segment
  })
}

export function formatValidationMessage(
  issues: readonly StandardIssue[],
): string {
  const firstError = issues[0]
  if (!firstError) return 'Validation failed'

  const path = standardIssuePath(firstError).join('.')
  if (path) return `${path}: ${firstError.message}`

  return firstError.message
}

export function createValidationException(issues: readonly StandardIssue[]) {
  const errors = issues.map((issue) => {
    const path = standardIssuePath(issue)
    return {
      field: path.join('.'),
      path,
      code: issue.code ?? 'invalid',
      message: issue.message,
    }
  })
  return new AppException(
    ErrorCodes.VALIDATION_FAILED,
    formatValidationMessage(issues),
    HttpStatus.UNPROCESSABLE_ENTITY,
    { errors, issues },
  )
}

export const standardSchemaValidationPipeInstance =
  new StandardSchemaValidationPipe({
    transform: true,
    validateCustomDecorators: false,
    exceptionFactory: createValidationException,
  })

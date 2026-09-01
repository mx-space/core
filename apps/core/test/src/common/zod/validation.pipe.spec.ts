import { HttpStatus } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ErrorCodes } from '~/common/errors/exception.types'
import {
  createValidationException,
  formatValidationMessage,
  standardIssuePath,
} from '~/common/zod/validation.pipe'

describe('standard schema validation exception factory', () => {
  it('joins plain path keys and { key } segments', () => {
    expect(
      standardIssuePath({
        message: 'required',
        path: ['user', { key: 'email' }, 0],
      }),
    ).toEqual(['user', 'email', 0])
  })

  it('formats the first issue as path: message', () => {
    expect(
      formatValidationMessage([
        { message: 'Required', path: ['status'] },
        { message: 'Too small', path: ['size'] },
      ]),
    ).toBe('status: Required')
  })

  it('returns 422 VALIDATION_FAILED with errors and raw issues', () => {
    const issues = [
      { message: 'Invalid option', path: ['status'], code: 'invalid_value' },
    ]
    const exception = createValidationException(issues)
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(exception.code).toBe(ErrorCodes.VALIDATION_FAILED)
    expect(exception.message).toBe('status: Invalid option')
    expect(exception.details).toEqual({
      errors: [
        {
          field: 'status',
          path: ['status'],
          code: 'invalid_value',
          message: 'Invalid option',
        },
      ],
      issues,
    })
  })
})

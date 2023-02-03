import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { isDev } from '~/global/env.global'

import { AuthGuard } from '../guards/auth.guard'

export function Auth() {
  const decorators: (ClassDecorator | PropertyDecorator | MethodDecorator)[] =
    []

  if (isDev) {
    decorators.push(
      ApiBearerAuth(),
      ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    )
  }

  decorators.push(UseGuards(AuthGuard))

  return applyDecorators(...decorators)
}

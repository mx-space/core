import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { SECURITY } from '~/app.config'

import { JWTAuthGuard } from '../guard/auth.guard'

export function Auth() {
  const decorators: (ClassDecorator | PropertyDecorator | MethodDecorator)[] =
    []
  if (!SECURITY.skipAuth) {
    decorators.push(UseGuards(JWTAuthGuard))
  }
  decorators.push(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  )
  return applyDecorators(...decorators)
}

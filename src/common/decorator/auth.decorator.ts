import { applyDecorators, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { SECURITY } from '~/app.config'

export function Auth() {
  const decorators = []
  if (!SECURITY.skipAuth) {
    decorators.push(UseGuards(AuthGuard('jwt')))
  }
  decorators.push(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  )
  return applyDecorators(...decorators)
}

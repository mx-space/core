import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { JWTAuthGuard } from '../guard/auth.guard'
import { SECURITY } from '~/app.config'

export function Auth() {
  const decorators = []
  if (!SECURITY.skipAuth) {
    decorators.push(UseGuards(JWTAuthGuard))
  }
  decorators.push(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  )
  return applyDecorators(...decorators)
}

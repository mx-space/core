import { applyDecorators, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../guards/auth.guard'

export function Auth() {
  const decorators: (ClassDecorator | PropertyDecorator | MethodDecorator)[] = [
    UseGuards(AuthGuard),
  ]

  return applyDecorators(...decorators)
}

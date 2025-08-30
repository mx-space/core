import { applyDecorators, UseGuards } from '@nestjs/common'
import { AuthTestingGuard } from '../guard/auth.guard'

export function Auth() {
  const decorators: (ClassDecorator | PropertyDecorator | MethodDecorator)[] =
    []

  decorators.push(UseGuards(AuthTestingGuard))

  return applyDecorators(...decorators)
}

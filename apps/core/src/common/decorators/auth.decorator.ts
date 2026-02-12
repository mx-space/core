import { UseGuards } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'

export function Auth() {
  return UseGuards(AuthGuard)
}

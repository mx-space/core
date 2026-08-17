import { UseGuards } from '@nestjs/common'

import { PushAuthGuard } from '../guards/push-auth.guard'

export function PushAuth() {
  return UseGuards(PushAuthGuard)
}

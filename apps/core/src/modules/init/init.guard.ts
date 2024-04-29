import { checkInit } from '~/utils/check-init.util'
import type { CanActivate } from '@nestjs/common'

export class InitGuard implements CanActivate {
  async canActivate() {
    return !(await checkInit())
  }
}

import type { CanActivate } from '@nestjs/common'
import { checkInit } from '~/utils/check-init.util'

export class InitGuard implements CanActivate {
  async canActivate() {
    return !(await checkInit())
  }
}

import type { CanActivate } from '@nestjs/common'
import type { Observable } from 'rxjs'

import { applyDecorators, UseGuards } from '@nestjs/common'

import { banInDemo } from '~/utils'

class DemoGuard implements CanActivate {
  canActivate(): boolean | Promise<boolean> | Observable<boolean> {
    banInDemo()
    return true
  }
}
export const BanInDemo = applyDecorators(UseGuards(DemoGuard))

import { Observable } from 'rxjs'

import { CanActivate, UseGuards, applyDecorators } from '@nestjs/common'

import { banInDemo } from '~/utils'

class DemoGuard implements CanActivate {
  canActivate(): boolean | Promise<boolean> | Observable<boolean> {
    banInDemo()
    return true
  }
}
export const BanInDemo = applyDecorators(UseGuards(DemoGuard))

import { UseGuards, applyDecorators } from '@nestjs/common'
import { banInDemo } from '~/utils'
import type { CanActivate } from '@nestjs/common'
import type { Observable } from 'rxjs'

class DemoGuard implements CanActivate {
  canActivate(): boolean | Promise<boolean> | Observable<boolean> {
    banInDemo()
    return true
  }
}
export const BanInDemo = applyDecorators(UseGuards(DemoGuard))

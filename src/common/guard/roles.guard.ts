/*
 * @Author: Innei
 * @Date: 2020-11-24 16:20:37
 * @LastEditTime: 2021-03-21 18:13:17
 * @LastEditors: Innei
 * @FilePath: /server/apps/server/src/auth/roles.guard.ts
 * Mark: Coding with Love
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { getNestExecutionContextRequest } from '~/utils/nest.util'

/**
 * 区分游客和主人的守卫
 */

@Injectable()
export class RolesGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    let isMaster = false
    const request = this.getRequest(context)

    if (request.headers['authorization']) {
      try {
        isMaster = (await super.canActivate(context)) as boolean
      } catch {}
    }
    request.isGuest = !isMaster
    request.isMaster = isMaster
    return true
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}

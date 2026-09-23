import type { CanActivate } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { checkInit } from '~/utils/check-init.util'

import { InitService } from './init.service'

export class InitGuard implements CanActivate {
  async canActivate() {
    return !(await checkInit())
  }
}

@Injectable()
export class InitRestoreGuard implements CanActivate {
  constructor(private readonly initService: InitService) {}

  async canActivate() {
    if (await this.initService.isInit()) {
      throw createAppException(AppErrorCode.INIT_ALREADY_COMPLETED)
    }
    return true
  }
}

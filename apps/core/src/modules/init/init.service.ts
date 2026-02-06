import { Injectable } from '@nestjs/common'
import { DATA_DIR, TEMP_DIR } from '~/constants/path.constant'
import { AuthService } from '../auth/auth.service'
import { OwnerService } from '../owner/owner.service'
import type { InitOwnerCreateInput } from './init.schema'

@Injectable()
export class InitService {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly authService: AuthService,
  ) {}

  getTempdir() {
    return TEMP_DIR
  }

  getDatadir() {
    return DATA_DIR
  }

  isInit(): Promise<boolean> {
    return this.ownerService.hasOwner()
  }

  createOwner(input: InitOwnerCreateInput) {
    return this.authService.createOwnerByCredential(input)
  }
}

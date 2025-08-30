import { Injectable } from '@nestjs/common'
import { DATA_DIR, TEMP_DIR } from '~/constants/path.constant'
import { UserService } from '../user/user.service'

@Injectable()
export class InitService {
  constructor(private readonly userService: UserService) {}

  getTempdir() {
    return TEMP_DIR
  }

  getDatadir() {
    return DATA_DIR
  }

  isInit(): Promise<boolean> {
    return this.userService.hasMaster()
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { UserService } from '../user/user.service'
import { DATA_DIR, TEMP_DIR } from '~/constants/path.constant'

@Injectable()
export class InitService {
  private logger = new Logger(InitService.name)
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

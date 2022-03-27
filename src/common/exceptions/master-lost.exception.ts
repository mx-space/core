import { InternalServerErrorException } from '@nestjs/common'

export class MasterLostException extends InternalServerErrorException {
  constructor() {
    super('系统异常，站点主人信息已丢失')
  }
}

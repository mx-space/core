import { AppException } from '~/common/response/error.types'

export class BanInDemoExcpetion extends AppException {
  constructor() {
    super('DEMO_FORBIDDEN', 'Demo 模式下此操作不可用', 403)
  }
}

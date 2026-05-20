import { AppException } from '~/common/response/error.types'

export class NoContentCanBeModifiedException extends AppException {
  constructor() {
    super('NO_CONTENT_MODIFIABLE', '内容不存在，没有内容可被修改', 400)
  }
}

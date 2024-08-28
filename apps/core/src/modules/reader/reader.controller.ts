import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

@ApiController('readers')
@Auth()
export class ReaderController {}

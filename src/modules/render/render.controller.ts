import { Controller } from '@nestjs/common'

import { ApiName } from '~/common/decorator/openapi.decorator'

@ApiName
@Controller('/render')
export class RenderEjsController {}

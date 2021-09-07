import { Controller } from '@nestjs/common'
import { ApiName } from '~/common/decorator/openapi.decorator'

@Controller('tools')
@ApiName
export class ToolController {}

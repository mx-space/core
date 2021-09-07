import { Controller } from '@nestjs/common'
import { ApiName } from '~/common/decorator/openapi.decorator'

@Controller('aggregate')
@ApiName
export class AggregateController {}

import { Get, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import { PersonaKeyParamDto } from './ai-persona.schema'
import { AiPersonaService } from './ai-persona.service'

@ApiController('ai-persona')
export class AiPersonaController {
  constructor(private readonly service: AiPersonaService) {}

  @Get('/')
  @Auth()
  list() {
    return this.service.listPersonasWithStatus()
  }

  @Get('/:key/profile')
  @Auth()
  getProfile(@Param() params: PersonaKeyParamDto) {
    return this.service.getProfile(params.key)
  }

  @Post('/:key/refresh')
  @Auth()
  refresh(@Param() params: PersonaKeyParamDto) {
    return this.service.refresh(params.key)
  }
}

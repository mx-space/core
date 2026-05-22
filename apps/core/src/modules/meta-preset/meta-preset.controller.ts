import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'

import {
  CreateMetaPresetDto,
  QueryMetaPresetDto,
  UpdateMetaPresetDto,
  UpdateOrderDto,
} from './meta-preset.schema'
import { MetaPresetService } from './meta-preset.service'

@ApiController({ path: 'meta-presets' })
export class MetaPresetController {
  constructor(private readonly metaPresetService: MetaPresetService) {}

  @Get('/')
  async getAll(@Query() query: QueryMetaPresetDto) {
    const { scope, enabledOnly } = query
    return this.metaPresetService.findAll(scope, enabledOnly)
  }

  @Get('/:id')
  async getById(@Param() { id }: EntityIdDto) {
    return this.metaPresetService.findById(id)
  }

  @Post('/')
  @Auth()
  async create(@Body() dto: CreateMetaPresetDto) {
    return this.metaPresetService.create(dto)
  }

  @Patch('/:id')
  @Auth()
  async update(@Param() { id }: EntityIdDto, @Body() dto: UpdateMetaPresetDto) {
    return this.metaPresetService.update(id, dto)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() { id }: EntityIdDto) {
    return this.metaPresetService.delete(id)
  }

  @Put('/order')
  @Auth()
  async updateOrder(@Body() dto: UpdateOrderDto) {
    return this.metaPresetService.updateOrder(dto.ids)
  }
}

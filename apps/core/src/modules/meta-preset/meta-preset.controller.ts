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
import { EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import {
  CreateMetaPresetDto,
  CreateMetaPresetSchema,
  QueryMetaPresetDto,
  QueryMetaPresetSchema,
  UpdateMetaPresetDto,
  UpdateMetaPresetSchema,
  UpdateOrderDto,
  UpdateOrderSchema,
} from './meta-preset.schema'
import { MetaPresetService } from './meta-preset.service'

@ApiController({ path: 'meta-presets' })
export class MetaPresetController {
  constructor(private readonly metaPresetService: MetaPresetService) {}

  @Get('/')
  async getAll(
    @Query({ schema: QueryMetaPresetSchema }) query: QueryMetaPresetDto,
  ) {
    const { scope, enabledOnly } = query
    return this.metaPresetService.findAll(scope, enabledOnly)
  }

  @Get('/:id')
  async getById(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.metaPresetService.findById(id)
  }

  @Post('/')
  @Auth()
  async create(
    @Body({ schema: CreateMetaPresetSchema }) dto: CreateMetaPresetDto,
  ) {
    return this.metaPresetService.create(dto)
  }

  @Patch('/:id')
  @Auth()
  async update(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Body({ schema: UpdateMetaPresetSchema }) dto: UpdateMetaPresetDto,
  ) {
    return this.metaPresetService.update(id, dto)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.metaPresetService.delete(id)
  }

  @Put('/order')
  @Auth()
  async updateOrder(@Body({ schema: UpdateOrderSchema }) dto: UpdateOrderDto) {
    return this.metaPresetService.updateOrder(dto.ids)
  }
}

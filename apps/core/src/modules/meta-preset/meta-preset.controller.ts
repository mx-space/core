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
import { MongoIdDto } from '~/shared/dto/id.dto'
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

  /**
   * 获取所有预设字段
   * 支持按 scope 过滤
   */
  @Get('/')
  async getAll(@Query() query: QueryMetaPresetDto) {
    const { scope, enabledOnly } = query
    return this.metaPresetService.findAll(scope, enabledOnly)
  }

  /**
   * 获取单个预设字段
   */
  @Get('/:id')
  async getById(@Param() { id }: MongoIdDto) {
    return this.metaPresetService.findById(id)
  }

  /**
   * 创建自定义预设字段
   */
  @Post('/')
  @Auth()
  async create(@Body() dto: CreateMetaPresetDto) {
    return this.metaPresetService.create(dto)
  }

  /**
   * 更新预设字段
   */
  @Patch('/:id')
  @Auth()
  async update(@Param() { id }: MongoIdDto, @Body() dto: UpdateMetaPresetDto) {
    return this.metaPresetService.update(id, dto)
  }

  /**
   * 删除预设字段
   */
  @Delete('/:id')
  @Auth()
  async delete(@Param() { id }: MongoIdDto) {
    return this.metaPresetService.delete(id)
  }

  /**
   * 批量更新排序
   */
  @Put('/order')
  @Auth()
  async updateOrder(@Body() dto: UpdateOrderDto) {
    return this.metaPresetService.updateOrder(dto.ids)
  }
}

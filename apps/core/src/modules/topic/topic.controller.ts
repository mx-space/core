import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import slugify from 'slugify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import type { EntryTranslation } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { TopicRepository } from './topic.repository'
import { TopicSlugParamsDto } from './topic.schema'
import type { TopicCreateInput, TopicPatchInput } from './topic.types'

@ApiController('topics')
export class TopicBaseController {
  constructor(
    protected readonly repository: TopicRepository,
    private readonly translationService: TranslationService,
  ) {}

  @Get('/all')
  async getAll(@Lang() lang?: string) {
    const data = await this.repository.findAll()
    const metaBuilder = new MetaObjectBuilder().view('card')

    if (lang && data.length) {
      const translationMap = await this.buildTopicTranslationMap(data, lang)
      if (translationMap.size > 0) {
        metaBuilder.translation(translationMap)
      }
    }

    return withMeta(data, metaBuilder.build())
  }

  private async buildTopicTranslationMap(
    topics: { id: unknown }[],
    lang: string,
  ): Promise<Map<string, EntryTranslation>> {
    const fieldsMap = await this.translationService.getTopicTranslationFields(
      lang,
      topics.map((topic) => String(topic.id)),
    )
    const map = new Map<string, EntryTranslation>()
    for (const [id, fields] of fieldsMap) {
      map.set(id, { fields })
    }
    return map
  }

  @Get('/slug/:slug')
  async getTopicByTopic(@Param() { slug }: TopicSlugParamsDto) {
    slug = slugify(slug)
    const topic = await this.repository.findBySlug(slug)
    if (!topic) {
      throw createAppException(AppErrorCode.TOPIC_NOT_FOUND)
    }
    return topic
  }

  @Get('/:id')
  async get(@Param() param: EntityIdDto) {
    const data = await this.repository.findById(param.id)
    if (!data) {
      throw createAppException(AppErrorCode.TOPIC_NOT_FOUND, { id: param.id })
    }
    return data
  }

  @Get('/')
  async gets(@Query() pager: BasicPagerDto) {
    const size = pager.size ?? 10
    const page = pager.page ?? 1
    const result = await this.repository.list(page, size)
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .view('card')
        .pagination({
          page: (result.pagination as any).currentPage ?? 1,
          size: (result.pagination as any).size ?? 10,
          total: (result.pagination as any).total ?? 0,
          totalPages: (result.pagination as any).totalPage ?? 1,
        })
        .build(),
    )
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: TopicCreateInput) {
    const created = await this.repository.create(body)
    return created
  }

  @Put('/:id')
  @Auth()
  async update(@Body() body: TopicCreateInput, @Param() param: EntityIdDto) {
    const updated = await this.repository.update(param.id, body)
    return updated
  }

  @Patch('/:id')
  @Auth()
  @HttpCode(204)
  async patch(@Body() body: TopicPatchInput, @Param() param: EntityIdDto) {
    await this.repository.update(param.id, body)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async delete(@Param() param: EntityIdDto) {
    await this.repository.deleteById(param.id)
  }
}

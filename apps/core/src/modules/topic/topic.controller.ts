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
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import {
  applyTranslationEntriesInPlace,
  type EntryRule,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { TopicRepository } from './topic.repository'
import { TopicSlugParamsDto } from './topic.schema'
import type { TopicCreateInput, TopicPatchInput } from './topic.types'

const TOPIC_ENTRY_RULES: ReadonlyArray<EntryRule> = [
  { path: 'name', keyPath: 'topic.name', mode: 'entity', idField: 'id' },
  {
    path: 'introduce',
    keyPath: 'topic.introduce',
    mode: 'entity',
    idField: 'id',
  },
  {
    path: 'description',
    keyPath: 'topic.description',
    mode: 'entity',
    idField: 'id',
  },
]

@ApiController('topics')
export class TopicBaseController {
  constructor(
    protected readonly repository: TopicRepository,
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  @Get('/all')
  async getAll(@Lang() lang?: string) {
    const data = await this.repository.findAll()

    if (lang && data.length) {
      const ids = new Set(data.map((t) => String(t.id)))
      const entryMaps = await this.translationEntryService.getTranslationsBatch(
        lang,
        {
          entityLookups: [
            { keyPath: 'topic.name', lookupKeys: ids },
            { keyPath: 'topic.introduce', lookupKeys: ids },
            { keyPath: 'topic.description', lookupKeys: ids },
          ],
        },
      )
      for (const topic of data) {
        applyTranslationEntriesInPlace(
          topic as any,
          entryMaps,
          TOPIC_ENTRY_RULES,
        )
      }
    }

    return data
  }

  @Get('/slug/:slug')
  async getTopicByTopic(
    @Param() { slug }: TopicSlugParamsDto,
    @Lang() lang?: string,
  ) {
    slug = slugify(slug)
    const topic = await this.repository.findBySlug(slug)
    if (!topic) {
      throw createAppException(AppErrorCode.TOPIC_NOT_FOUND)
    }

    if (lang) {
      const id = String(topic.id)
      const entryMaps = await this.translationEntryService.getTranslationsBatch(
        lang,
        {
          entityLookups: [
            { keyPath: 'topic.name', lookupKeys: new Set([id]) },
            { keyPath: 'topic.introduce', lookupKeys: new Set([id]) },
            { keyPath: 'topic.description', lookupKeys: new Set([id]) },
          ],
        },
      )
      applyTranslationEntriesInPlace(topic as any, entryMaps, TOPIC_ENTRY_RULES)
    }

    return topic
  }

  @Get('/:id')
  async get(@Param() param: EntityIdDto, @Lang() lang?: string) {
    const data = await this.repository.findById(param.id)
    if (!data) {
      throw createAppException(AppErrorCode.TOPIC_NOT_FOUND, { id: param.id })
    }

    if (lang) {
      const id = String(data.id)
      const entryMaps = await this.translationEntryService.getTranslationsBatch(
        lang,
        {
          entityLookups: [
            { keyPath: 'topic.name', lookupKeys: new Set([id]) },
            { keyPath: 'topic.introduce', lookupKeys: new Set([id]) },
            { keyPath: 'topic.description', lookupKeys: new Set([id]) },
          ],
        },
      )
      applyTranslationEntriesInPlace(data as any, entryMaps, TOPIC_ENTRY_RULES)
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

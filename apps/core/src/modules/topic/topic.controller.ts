import { Get, Param } from '@nestjs/common'
import slugify from 'slugify'

import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'

import { TopicRepository } from './topic.repository'
import { TopicSlugParamsDto } from './topic.schema'

const topicTranslateFields = [
  { path: 'name', keyPath: 'topic.name' as const, idField: 'id' as const },
  {
    path: 'introduce',
    keyPath: 'topic.introduce' as const,
    idField: 'id' as const,
  },
  {
    path: 'description',
    keyPath: 'topic.description' as const,
    idField: 'id' as const,
  },
]

const topicTranslateListFields = [
  { path: '[].name', keyPath: 'topic.name' as const, idField: 'id' as const },
  {
    path: '[].introduce',
    keyPath: 'topic.introduce' as const,
    idField: 'id' as const,
  },
  {
    path: '[].description',
    keyPath: 'topic.description' as const,
    idField: 'id' as const,
  },
]

export class TopicBaseController extends BasePgCrudFactory({
  repository: TopicRepository,
}) {
  @Get('/all')
  @TranslateFields(...topicTranslateListFields)
  async getAll() {
    return this.repository.findAll()
  }

  @Get('/slug/:slug')
  @TranslateFields(...topicTranslateFields)
  async getTopicByTopic(@Param() { slug }: TopicSlugParamsDto) {
    slug = slugify(slug)
    const topic = await this.repository.findBySlug(slug)
    if (!topic) {
      throw new CannotFindException()
    }
    return topic
  }

  @Get('/:id')
  @TranslateFields(...topicTranslateFields)
  async get(@Param() param: EntityIdDto) {
    return this.repository.findById(param.id)
  }
}

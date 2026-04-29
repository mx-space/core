import { Get, Param } from '@nestjs/common'
import slugify from 'slugify'

import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'

import { TopicModel } from './topic.model'
import { TopicSlugParamsDto } from './topic.schema'

const topicTranslateFields = [
  { path: 'name', keyPath: 'topic.name' as const, idField: '_id' as const },
  {
    path: 'introduce',
    keyPath: 'topic.introduce' as const,
    idField: '_id' as const,
  },
  {
    path: 'description',
    keyPath: 'topic.description' as const,
    idField: '_id' as const,
  },
]

const topicTranslateListFields = [
  { path: '[].name', keyPath: 'topic.name' as const, idField: '_id' as const },
  {
    path: '[].introduce',
    keyPath: 'topic.introduce' as const,
    idField: '_id' as const,
  },
  {
    path: '[].description',
    keyPath: 'topic.description' as const,
    idField: '_id' as const,
  },
]

export class TopicBaseController extends BaseCrudFactory({
  model: TopicModel,
}) {
  @Get('/all')
  @TranslateFields(...topicTranslateListFields)
  async getAll() {
    return await this.model.find({}).sort({ created: -1 }).lean()
  }

  @Get('/slug/:slug')
  @TranslateFields(...topicTranslateFields)
  async getTopicByTopic(@Param() { slug }: TopicSlugParamsDto) {
    slug = slugify(slug)
    const topic = await this.model.findOne({ slug }).lean()
    if (!topic) {
      throw new CannotFindException()
    }

    return topic
  }

  @Get('/:id')
  @TranslateFields(...topicTranslateFields)
  async get(@Param() param: MongoIdDto) {
    return await this.model.findById(param.id).lean()
  }
}

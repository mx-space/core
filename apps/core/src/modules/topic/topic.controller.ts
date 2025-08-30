import { Get, Param } from '@nestjs/common'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'
import slugify from 'slugify'
import { TopicModel } from './topic.model'

class Upper {
  constructor(private readonly _model: MongooseModel<TopicModel>) {}

  @Get('/slug/:slug')
  async getTopicByTopic(@Param('slug') slug: string) {
    slug = slugify(slug)
    const topic = await this._model.findOne({ slug }).lean()
    if (!topic) {
      throw new CannotFindException()
    }

    return topic
  }
}

export const TopicBaseController = BaseCrudFactory({
  model: TopicModel,

  classUpper: Upper,
})

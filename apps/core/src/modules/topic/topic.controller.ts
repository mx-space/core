import { Body, Get, Param, Post, Put } from '@nestjs/common'
import slugify from 'slugify'

import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'

import { TopicModel } from './topic.model'

class Upper {
  constructor(private readonly _model: MongooseModel<TopicModel>) {}

  @Get('/slug/:slug')
  @TranslateFields(
    { path: 'name', keyPath: 'topic.name', idField: '_id' },
    { path: 'introduce', keyPath: 'topic.introduce', idField: '_id' },
  )
  async getTopicByTopic(@Param('slug') slug: string) {
    slug = slugify(slug)
    const topic = await this._model.findOne({ slug }).lean()
    if (!topic) {
      throw new CannotFindException()
    }

    return topic
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: Partial<TopicModel>) {
    return await this._model.create(body)
  }

  @Put('/:id')
  @Auth()
  async update(@Body() body: Partial<TopicModel>, @Param() param: MongoIdDto) {
    return await this._model
      .findOneAndUpdate({ _id: param.id }, body, { new: true })
      .lean()
  }
}

export const TopicBaseController = BaseCrudFactory({
  model: TopicModel,

  classUpper: Upper,
})

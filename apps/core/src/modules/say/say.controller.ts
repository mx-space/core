import { Get } from '@nestjs/common'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'
import { sample } from 'lodash'
import { SayModel } from './say.model'

export class SayController extends BaseCrudFactory({ model: SayModel }) {
  @Get('/random')
  async getRandomOne() {
    const res = await this.model.find({}).lean()
    if (res.length === 0) {
      return { data: null }
    }
    return { data: sample(res) }
  }
}

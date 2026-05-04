import { Get } from '@nestjs/common'
import { sample } from 'es-toolkit/compat'

import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'

import { SayRepository } from './say.repository'

export class SayController extends BasePgCrudFactory({
  repository: SayRepository,
}) {
  @Get('/random')
  async getRandomOne() {
    const res = await this.repository.findAll()
    if (res.length === 0) {
      return { data: null }
    }
    return { data: sample(res) }
  }
}

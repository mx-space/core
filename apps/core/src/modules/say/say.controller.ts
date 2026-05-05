import { Get } from '@nestjs/common'
import { sample } from 'es-toolkit/compat'

import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'

import { SayRepository } from './say.repository'

export class SayController extends BasePgCrudFactory({
  repository: SayRepository,
}) {
  @Get('/random')
  async getRandomOne() {
    const rows = await this.repository.findAll()
    return { data: rows.length === 0 ? null : sample(rows) }
  }
}

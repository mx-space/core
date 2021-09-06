import { Body, Delete, Get, Param, Post } from '@nestjs/common'
import { sample } from 'lodash'
import { Auth } from '~/common/decorator/auth.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { EventTypes } from '~/processors/gateway/events.types'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { BaseCrudFactory } from '~/utils/crud.util'
import { SayModel } from './say.model'

export class SayController extends BaseCrudFactory({ model: SayModel }) {
  @Get('/random')
  async getRandomOne() {
    const res = await this.model.find({}).lean()
    if (!res.length) {
      throw new CannotFindException()
    }
    return sample(res)
  }

  @Post('/')
  @Auth()
  async create(@Body() body: Partial<SayModel>) {
    const r = await super.post(body)
    process.nextTick(async () => {
      await this.webgateway.broadcast(EventTypes.SAY_CREATE, r)
    })
    return r
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() params: MongoIdDto) {
    await super.delete(params)
    process.nextTick(async () => {
      await this.webgateway.broadcast(EventTypes.SAY_DELETE, params.id)
    })
    return 'OK'
  }
}

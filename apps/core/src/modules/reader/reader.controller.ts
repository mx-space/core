import { Body, Get, Patch } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { ReaderService } from './reader.service'

@ApiController('readers')
@Auth()
export class ReaderAuthController {
  constructor(private readonly readerService: ReaderService) {}
  @Get('/')
  async find() {
    return this.readerService.find()
  }

  @Patch('/as-owner')
  async updateAsOwner(@Body() body: MongoIdDto) {
    return this.readerService.updateAsOwner(body.id)
  }

  @Patch('/revoke-owner')
  async revokeOwner(@Body() body: MongoIdDto) {
    return this.readerService.revokeOwner(body.id)
  }
}

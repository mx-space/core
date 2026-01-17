import { Body, Get, Patch, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { ReaderService } from './reader.service'

@ApiController('readers')
@Auth()
export class ReaderAuthController {
  constructor(private readonly readerService: ReaderService) {}
  @Get('/')
  @HTTPDecorators.Paginator
  async find(@Query() query: PagerDto) {
    const { page = 1, size = 20 } = query
    return this.readerService.findPaginated(page, size)
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

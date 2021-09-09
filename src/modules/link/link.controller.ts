import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Auth } from '~/common/decorator/auth.decorator'
import { BaseCrudFactory } from '~/utils/crud.util'
import { LinkQueryDto } from './link.dto'
import { LinkModel } from './link.model'
import { LinkService } from './link.service'

@Controller(['links', 'friends'])
export class LinkControllerCrud extends BaseCrudFactory({
  model: LinkModel,
}) {}

@Controller(['links', 'friends'])
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Get('/state')
  @Auth()
  async getLinkCount() {
    return await this.linkService.getCount()
  }

  @Post('/audit')
  @HttpCode(204)
  async applyForLink(@Body() body: LinkModel, @Query() query: LinkQueryDto) {
    await this.linkService.applyForLink(body)
    process.nextTick(async () => {
      await this.linkService.sendToMaster(query.author, body)
    })

    return
  }

  @Patch('/audit/:id')
  @Auth()
  @HttpCode(204)
  async approveLink(@Param('id') id: string) {
    const doc = await this.linkService.approveLink(id)

    process.nextTick(async () => {
      if (doc.email) {
        this.linkService.sendToCandidate(doc)
      }
    })
    return
  }
}

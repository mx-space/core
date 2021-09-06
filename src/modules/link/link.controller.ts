import { Body, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { Auth } from '~/common/decorator/auth.decorator'
import { BaseCrudFactory } from '~/utils/crud.util'
import { SayModel } from '../say/say.model'
import { LinkQueryDto } from './link.dto'
import { LinkModel } from './link.model'
import { LinkService } from './link.service'

export class LinkController extends BaseCrudFactory({
  model: LinkModel,
}) {
  constructor(
    private readonly linkService: LinkService,
    // FIXME: dup inject
    @InjectModel(SayModel) private readonly sayModel: MongooseModel<SayModel>,
  ) {
    super(sayModel)
  }

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

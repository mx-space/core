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
import { Paginator } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { PagerDto } from '~/shared/dto/pager.dto'
import { BaseCrudFactory } from '~/utils/crud.util'
import { LinkQueryDto } from './link.dto'
import { LinkModel } from './link.model'
import { LinkService } from './link.service'

const paths = ['links', 'friends']
@Controller(paths)
@ApiName
export class LinkControllerCrud extends BaseCrudFactory({
  model: LinkModel,
}) {
  @Get('/')
  @Paginator
  async gets(@Query() pager: PagerDto, @IsMaster() isMaster: boolean) {
    const { size, page, state } = pager
    // @ts-ignore
    return await this._model.paginate(state !== undefined ? { state } : {}, {
      limit: size,
      page,
      sort: { created: -1 },
      select: isMaster ? '' : '-email',
    })
  }
}

@Controller(paths)
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
        await this.linkService.sendToCandidate(doc)
      }
    })
    return
  }
}

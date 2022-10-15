import mongoose from 'mongoose'

import {
  Body,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import {
  BaseCrudFactory,
  BaseCrudModuleType,
} from '~/transformers/crud-factor.transformer'

import { AduitReasonDto, LinkDto } from './link.dto'
import { LinkModel, LinkState } from './link.model'
import { LinkService } from './link.service'

const paths = ['links', 'friends']

@ApiController(paths)
@ApiName
export class LinkControllerCrud extends BaseCrudFactory({
  model: LinkModel,
}) {
  @Get('/')
  @Paginator
  async gets(
    this: BaseCrudModuleType<LinkModel>,
    @Query() pager: PagerDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { size, page, state } = pager

    return await this._model.paginate(state !== undefined ? { state } : {}, {
      limit: size,
      page,
      sort: { created: -1 },
      select: isMaster ? '' : '-email',
    })
  }

  @Get('/all')
  async getAll(
    this: BaseCrudModuleType<LinkModel>,
    @IsMaster() isMaster: boolean,
  ) {
    // 过滤未通过审核的
    const condition: mongoose.FilterQuery<LinkModel> = {
      state: LinkState.Pass,
    }
    return await this._model
      .find(condition)
      .sort({ created: -1 })
      .select(isMaster ? '' : '-email')
      .lean()
  }
}

@ApiController(paths)
@ApiName
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Get('/audit')
  async canApplyLink() {
    return {
      can: await this.linkService.canApplyLink(),
    }
  }

  @Get('/state')
  @Auth()
  async getLinkCount() {
    return await this.linkService.getCount()
  }

  /** 申请友链 */
  @Post('/audit')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: '哦吼，你已经提交过这个友链了',
  })
  async applyForLink(@Body() body: LinkDto) {
    if (!(await this.linkService.canApplyLink())) {
      throw new ForbiddenException('主人目前不允许申请友链了！')
    }
    await this.linkService.applyForLink(body)
    process.nextTick(async () => {
      await this.linkService.sendToMaster(body.author, body)
    })

    return
  }

  @Patch('/audit/:id')
  @Auth()
  async approveLink(@Param('id') id: string) {
    const doc = await this.linkService.approveLink(id)

    process.nextTick(async () => {
      if (doc.email) {
        await this.linkService.sendToCandidate(doc)
      }
    })
    return
  }

  @Post('/audit/reason/:id')
  @Auth()
  @HttpCode(201)
  async sendReasonByEmail(
    @Param() params: MongoIdDto,
    @Body() body: AduitReasonDto,
  ) {
    const { id } = params
    const { reason, state } = body
    await this.linkService.sendAuditResultByEmail(id, reason, state)
  }

  @Auth()
  @Get('/health')
  async checkHealth() {
    return this.linkService.checkLinkHealth()
  }
}

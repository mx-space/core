import { Body, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { OK_DATA, withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'
import { scheduleManager } from '~/utils/schedule.util'

import { LinkRepository } from './link.repository'
import { AuditReasonDto, LinkDto, LinkPagerDto } from './link.schema'
import { LinkService } from './link.service'
import { LinkState } from './link.types'

const paths = ['links', 'friends']

@ApiController(paths)
export class LinkControllerCrud extends BasePgCrudFactory({
  repository: LinkRepository,
}) {
  @Get('/')
  async gets(
    @Query() pager: LinkPagerDto,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    const { size = 10, page = 1, state } = pager
    const result = await this.repository.list(page, size, {
      state: state !== undefined ? (Number(state) as LinkState) : undefined,
    })
    if (!hasAdminAccess) {
      result.data = result.data.map((row) => ({ ...row, email: null }))
    }
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/all')
  async getAll(@HasAdminAccess() hasAdminAccess: boolean) {
    const rows = await this.repository.findAvailable()
    const data = hasAdminAccess
      ? rows
      : rows.map((row) => ({ ...row, email: null }))
    return data
  }
}

@ApiController(paths)
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Get('/audit')
  async canApplyLink() {
    const can = await this.linkService.canApplyLink()
    return { can }
  }

  @Get('/state')
  @Auth()
  async getLinkCount() {
    const data = await this.linkService.getCount()
    return data
  }

  @Post('/audit')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: 'Oh, you have already submitted this friend link',
  })
  async applyForLink(@Body() body: LinkDto) {
    if (!(await this.linkService.canApplyLink())) {
      throw createAppException(AppErrorCode.LINK_APPLY_DISABLED)
    }
    await this.linkService.applyForLink(body as any)
    scheduleManager.schedule(async () => {
      await this.linkService.sendToOwner(body.author, body as any)
    })
    return OK_DATA
  }

  @Patch('/audit/:id')
  @Auth()
  async approveLink(@Param('id') id: string) {
    const { link, convertedAvatar } = await this.linkService.approveLink(id)
    scheduleManager.schedule(async () => {
      if (link.email) {
        await this.linkService.sendToCandidate(link)
      }
    })
    return { link, convertedAvatar }
  }

  @Post('/audit/reason/:id')
  @Auth()
  @HttpCode(201)
  async sendReasonByEmail(
    @Param() params: EntityIdDto,
    @Body() body: AuditReasonDto,
  ) {
    const { id } = params
    const { reason, state } = body
    await this.linkService.sendAuditResultByEmail(id, reason, state)
    return OK_DATA
  }

  @Auth()
  @Get('/health')
  async checkHealth() {
    const data = await this.linkService.checkLinkHealth()
    return data
  }

  @Post('/avatar/migrate')
  @Auth()
  async migrateExternalAvatars() {
    const data = await this.linkService.migrateExternalAvatarsForPassedLinks()
    return data
  }
}

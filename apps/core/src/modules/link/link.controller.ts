import { Body, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'
import { scheduleManager } from '~/utils/schedule.util'

import { LinkRepository, LinkState } from './link.repository'
import { AuditReasonDto, LinkDto } from './link.schema'
import { LinkService } from './link.service'

const paths = ['links', 'friends']

@ApiController(paths)
export class LinkControllerCrud extends BasePgCrudFactory({
  repository: LinkRepository,
}) {
  @Get('/')
  @Paginator
  async gets(
    @Query() pager: PagerDto,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    const { size = 10, page = 1, state } = pager
    const result = await this.repository.list(page, size, {
      state: state !== undefined ? (Number(state) as LinkState) : undefined,
    })
    if (!hasAdminAccess) {
      result.data = result.data.map((row) => ({ ...row, email: null }))
    }
    return result
  }

  @Get('/all')
  async getAll(@HasAdminAccess() hasAdminAccess: boolean) {
    const rows = await this.repository.findAvailable()
    return hasAdminAccess ? rows : rows.map((row) => ({ ...row, email: null }))
  }
}

@ApiController(paths)
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  @Get('/audit')
  async canApplyLink() {
    return { can: await this.linkService.canApplyLink() }
  }

  @Get('/state')
  @Auth()
  async getLinkCount() {
    return this.linkService.getCount()
  }

  /** 申请友链 */
  @Post('/audit')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: '哦吼，你已经提交过这个友链了',
  })
  async applyForLink(@Body() body: LinkDto) {
    if (!(await this.linkService.canApplyLink())) {
      throw new BizException(ErrorCodeEnum.LinkApplyDisabled)
    }
    await this.linkService.applyForLink(body as any)
    scheduleManager.schedule(async () => {
      await this.linkService.sendToOwner(body.author, body as any)
    })
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
  }

  @Auth()
  @Get('/health')
  async checkHealth() {
    return this.linkService.checkLinkHealth()
  }

  /** 批量迁移已通过友链的外部头像为内部链接 */
  @Post('/avatar/migrate')
  @Auth()
  async migrateExternalAvatars() {
    return this.linkService.migrateExternalAvatarsForPassedLinks()
  }
}

import {
  Body,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { DEMO_MODE } from '~/app.config'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { ReaderAuth } from '~/common/decorators/reader-auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'

import type { SessionUser } from '../auth/auth.types'
import { ConfigsService } from '../configs/configs.service'
import { MembershipService } from './membership.service'
import { DodoProvider } from './providers/dodo.provider'
import type { PaymentProviderAdapter } from './providers/provider.interface'

const CheckoutSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
})
class CheckoutDto extends createZodDto(CheckoutSchema) {}

const ManualGrantSchema = z.object({
  plan: z.enum(['monthly', 'yearly']),
  expiresAt: z.coerce.date(),
})
class ManualGrantDto extends createZodDto(ManualGrantSchema) {}

const MembersListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
})
class MembersListQueryDto extends createZodDto(MembersListQuerySchema) {}

const assertNotDemoMode = () => {
  if (DEMO_MODE) {
    throw createAppException(AppErrorCode.DEMO_FORBIDDEN)
  }
}

@ApiController('membership')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly configsService: ConfigsService,
    private readonly dodoProvider: DodoProvider,
  ) {}

  private resolveProvider(provider: string): PaymentProviderAdapter {
    if (provider === 'dodo') return this.dodoProvider
    throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
  }

  @ReaderAuth()
  @Post('/checkout')
  async checkout(@Body() body: CheckoutDto, @CurrentUser() user: SessionUser) {
    assertNotDemoMode()

    const membershipConfig = await this.configsService.get('membership')
    if (!membershipConfig.enabled || !membershipConfig.provider) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    const adapter = this.resolveProvider(membershipConfig.provider)
    return adapter.createCheckout({
      reader: { id: user.id, email: user.email, name: user.name },
      plan: body.plan,
    })
  }

  @ReaderAuth()
  @Get('/status')
  async status(@Req() req: FastifyBizRequest) {
    const readerId = req.readerId!
    const membership = await this.membershipService.getByReaderId(readerId)
    if (!membership) {
      return { status: 'none' as const }
    }

    return {
      status: membership.status,
      plan: membership.plan,
      provider: membership.provider,
      currentPeriodEnd: membership.currentPeriodEnd,
    }
  }

  @Post('/webhook/:provider')
  async webhook(
    @Param('provider') provider: string,
    @Req() req: FastifyBizRequest,
    @Headers() headers: Record<string, string>,
  ) {
    assertNotDemoMode()

    if (provider !== 'dodo') {
      throw createAppException(AppErrorCode.WEBHOOK_VERIFY_FAILED)
    }
    const adapter = this.dodoProvider
    const rawBody = req.rawBody ?? Buffer.alloc(0)
    const event = await adapter.verifyAndParseWebhook(rawBody, headers)
    const result = await this.membershipService.applyEvent(event)
    return { ok: true, applied: result.applied }
  }

  @Auth()
  @Get('/members')
  async members(@Query() query: MembersListQueryDto) {
    const result = await this.membershipService.listMembers(
      query.page,
      query.size,
    )
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Auth()
  @Put('/members/:readerId')
  async grant(
    @Param('readerId') readerId: string,
    @Body() body: ManualGrantDto,
  ) {
    return this.membershipService.grantManual(readerId, {
      plan: body.plan,
      expiresAt: body.expiresAt,
    })
  }

  @Auth()
  @Delete('/members/:readerId')
  async revoke(@Param('readerId') readerId: string) {
    return this.membershipService.revokeManual(readerId)
  }
}

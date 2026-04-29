import { Body, Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { IpLocation, type IpRecord } from '~/common/decorators/ip.decorator'

import { BatchPollQueryDto, PollIdDto, SubmitPollDto } from './poll.dto'
import { PollService } from './poll.service'

@ApiController('polls')
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Get('/')
  async batch(
    @Query() query: BatchPollQueryDto,
    @IpLocation() ipLocation: IpRecord,
    @CurrentReaderId() readerId?: string,
  ) {
    const fingerprint = this.pollService.computeFingerprint({
      readerId,
      ip: ipLocation.ip,
      agent: ipLocation.agent ?? '',
    })
    return this.pollService.batchGetStates(query.ids, fingerprint)
  }

  @Get('/:pollId')
  async getOne(
    @Param() params: PollIdDto,
    @IpLocation() ipLocation: IpRecord,
    @CurrentReaderId() readerId?: string,
  ) {
    const fingerprint = this.pollService.computeFingerprint({
      readerId,
      ip: ipLocation.ip,
      agent: ipLocation.agent ?? '',
    })
    return this.pollService.getState(params.pollId, fingerprint)
  }

  @Post('/:pollId/vote')
  async vote(
    @Param() params: PollIdDto,
    @Body() body: SubmitPollDto,
    @IpLocation() ipLocation: IpRecord,
    @CurrentReaderId() readerId?: string,
  ) {
    const fingerprint = this.pollService.computeFingerprint({
      readerId,
      ip: ipLocation.ip,
      agent: ipLocation.agent ?? '',
    })
    return this.pollService.submit(params.pollId, fingerprint, body.optionIds)
  }
}

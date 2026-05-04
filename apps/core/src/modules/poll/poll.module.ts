import { Module } from '@nestjs/common'

import { PollController } from './poll.controller'
import { PollService } from './poll.service'
import { PollVoteRepository } from './poll-vote.repository'

@Module({
  controllers: [PollController],
  providers: [PollService, PollVoteRepository],
  exports: [PollService],
})
export class PollModule {}

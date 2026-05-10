import { Module } from '@nestjs/common'

import { PollDefinitionRepository } from './poll-definition.repository'
import { PollController } from './poll.controller'
import { PollService } from './poll.service'
import { PollVoteRepository } from './poll-vote.repository'

@Module({
  controllers: [PollController],
  providers: [PollService, PollVoteRepository, PollDefinitionRepository],
  exports: [PollService],
})
export class PollModule {}

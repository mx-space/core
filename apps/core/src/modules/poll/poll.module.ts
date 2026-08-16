import { Module } from '@nestjs/common'

import { PollController } from './poll.controller'
import { PollService } from './poll.service'
import { PollDefinitionRepository } from './poll-definition.repository'
import { PollVoteRepository } from './poll-vote.repository'

@Module({
  controllers: [PollController],
  providers: [PollService, PollVoteRepository, PollDefinitionRepository],
  exports: [PollService, PollVoteRepository],
})
export class PollModule {}

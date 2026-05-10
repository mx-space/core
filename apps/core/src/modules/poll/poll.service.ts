import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { PollDefinitionRepository } from './poll-definition.repository'
import { isPollClosed } from './poll-definition.util'
import { PollVoteRepository } from './poll-vote.repository'

export interface PollState {
  tallies: Record<string, number>
  totalVotes: number
  userVote?: string[]
  status: 'ready' | 'error'
  closed: boolean
  canVote: boolean
  errorMessage?: string
}

interface FingerprintInput {
  readerId?: string | null
  ip: string
  agent: string
}

@Injectable()
export class PollService {
  private readonly logger = new Logger(PollService.name)

  constructor(
    private readonly pollVoteRepository: PollVoteRepository,
    private readonly pollDefinitionRepository: PollDefinitionRepository,
  ) {}

  /**
   * Stable identity for vote dedup. Logged-in readers map to `r:<id>`;
   * anonymous voters hash IP + UA into `a:<hex>`.
   */
  computeFingerprint({ readerId, ip, agent }: FingerprintInput): string {
    if (readerId) return `r:${readerId}`
    const digest = createHash('sha256')
      .update(`${ip}|${agent}`)
      .digest('hex')
      .slice(0, 32)
    return `a:${digest}`
  }

  async getState(pollId: string, voterFingerprint: string): Promise<PollState> {
    const [definition, tallyDocs, vote, totalVotes] = await Promise.all([
      this.pollDefinitionRepository.findByPollId(pollId),
      this.pollVoteRepository.tally(pollId),
      this.pollVoteRepository.findByPollAndFingerprint(
        pollId,
        voterFingerprint,
      ),
      this.pollVoteRepository.countForPoll(pollId),
    ])

    const tallies: Record<string, number> = {}
    for (const doc of tallyDocs) tallies[doc.optionId] = doc.count
    const closed = definition ? isPollClosed(definition) : false
    const canVote = !!definition && !closed && !vote && definition.options.length > 0

    return {
      tallies,
      totalVotes,
      userVote: vote?.optionIds,
      status: definition ? 'ready' : 'error',
      closed,
      canVote,
      ...(!definition ? { errorMessage: 'Poll not found' } : {}),
    }
  }

  async batchGetStates(
    pollIds: string[],
    voterFingerprint: string,
  ): Promise<Record<string, PollState>> {
    const out: Record<string, PollState> = {}
    await Promise.all(
      pollIds.map(async (pollId) => {
        out[pollId] = await this.getState(pollId, voterFingerprint)
      }),
    )
    return out
  }

  async submit(
    pollId: string,
    voterFingerprint: string,
    optionIds: string[],
  ): Promise<PollState> {
    const definition = await this.pollDefinitionRepository.findByPollId(pollId)
    if (!definition) {
      return this.errorState(pollId, voterFingerprint, 'Poll not found')
    }

    const guardError = this.validateVote(definition, optionIds)
    if (guardError) {
      return this.errorState(pollId, voterFingerprint, guardError)
    }

    try {
      await this.pollVoteRepository.castVote({
        pollId,
        voterFingerprint,
        optionIds,
      })
    } catch (err: any) {
      // PG unique_violation
      if (err?.code === '23505') {
        const state = await this.getState(pollId, voterFingerprint)
        return { ...state, status: 'error', errorMessage: 'Already voted' }
      }
      throw err
    }
    return this.getState(pollId, voterFingerprint)
  }

  private validateVote(
    definition: Awaited<ReturnType<PollDefinitionRepository['findByPollId']>>,
    optionIds: string[],
  ): string | null {
    if (!definition) return 'Poll not found'
    if (isPollClosed(definition)) return 'Poll closed'
    if (optionIds.length === 0) return 'No option selected'

    const uniqueOptionIds = new Set(optionIds)
    if (uniqueOptionIds.size !== optionIds.length) {
      return 'Duplicate option'
    }

    if (definition.mode === 'single' && optionIds.length !== 1) {
      return 'Multiple options not allowed'
    }

    const allowedOptions = new Set(definition.options.map((option) => option.id))
    if (optionIds.some((optionId) => !allowedOptions.has(optionId))) {
      return 'Invalid option'
    }

    return null
  }

  private async errorState(
    pollId: string,
    voterFingerprint: string,
    errorMessage: string,
  ): Promise<PollState> {
    const state = await this.getState(pollId, voterFingerprint)
    return {
      ...state,
      status: 'error',
      canVote: false,
      errorMessage,
    }
  }
}

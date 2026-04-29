import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { InjectModel } from '~/transformers/model.transformer'

import { PollVoteModel } from './poll-vote.model'

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
    @InjectModel(PollVoteModel)
    private readonly model: MongooseModel<PollVoteModel>,
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
    const [tallyDocs, vote, totalVotes] = await Promise.all([
      this.model
        .aggregate<{
          _id: string
          count: number
        }>([{ $match: { pollId } }, { $unwind: '$optionIds' }, { $group: { _id: '$optionIds', count: { $sum: 1 } } }])
        .exec(),
      this.model.findOne({ pollId, voterFingerprint }).lean().exec(),
      this.model.countDocuments({ pollId }).exec(),
    ])

    const tallies: Record<string, number> = {}
    for (const doc of tallyDocs) tallies[doc._id] = doc.count

    return {
      tallies,
      totalVotes,
      userVote: vote?.optionIds,
      status: 'ready',
      closed: false,
      canVote: !vote,
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
    try {
      await this.model.create({ pollId, voterFingerprint, optionIds })
    } catch (err: any) {
      if (err?.code === 11_000) {
        const state = await this.getState(pollId, voterFingerprint)
        return { ...state, status: 'error', errorMessage: 'Already voted' }
      }
      throw err
    }
    return this.getState(pollId, voterFingerprint)
  }
}

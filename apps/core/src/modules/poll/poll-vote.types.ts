import type { EntityId } from '~/shared/id/entity-id'

export interface PollVoteRow {
  id: EntityId
  pollId: string
  voterFingerprint: string
  optionIds: string[]
  createdAt: Date
}

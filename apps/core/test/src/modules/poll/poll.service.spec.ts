import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PollService } from '~/modules/poll/poll.service'

const openPoll = {
  pollId: 'p_vote',
  question: 'Choose',
  mode: 'single' as const,
  options: [
    { id: 'o_a', label: 'A' },
    { id: 'o_b', label: 'B' },
  ],
}

describe('PollService vote guard', () => {
  let voteRepository: {
    tally: ReturnType<typeof vi.fn>
    findByPollAndFingerprint: ReturnType<typeof vi.fn>
    countForPoll: ReturnType<typeof vi.fn>
    castVote: ReturnType<typeof vi.fn>
  }
  let definitionRepository: {
    findByPollId: ReturnType<typeof vi.fn>
  }
  let service: PollService

  beforeEach(() => {
    voteRepository = {
      tally: vi.fn().mockResolvedValue([]),
      findByPollAndFingerprint: vi.fn().mockResolvedValue(null),
      countForPoll: vi.fn().mockResolvedValue(0),
      castVote: vi.fn().mockResolvedValue(null),
    }
    definitionRepository = {
      findByPollId: vi.fn().mockResolvedValue(openPoll),
    }
    service = new PollService(voteRepository as any, definitionRepository as any)
  })

  it('reports not-votable state when the poll definition is not public', async () => {
    definitionRepository.findByPollId.mockResolvedValue(null)

    const state = await service.getState('p_vote', 'a:fingerprint')

    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      closed: false,
      errorMessage: 'Poll not found',
    })
  })

  it('rejects votes for unknown polls before writing vote rows', async () => {
    definitionRepository.findByPollId.mockResolvedValue(null)

    const state = await service.submit('p_vote', 'a:fingerprint', ['o_a'])

    expect(voteRepository.castVote).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      errorMessage: 'Poll not found',
    })
  })

  it('rejects closed polls before writing vote rows', async () => {
    definitionRepository.findByPollId.mockResolvedValue({
      ...openPoll,
      closeAt: '2000-01-01T00:00:00.000Z',
    })

    const state = await service.submit('p_vote', 'a:fingerprint', ['o_a'])

    expect(voteRepository.castVote).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      closed: true,
      errorMessage: 'Poll closed',
    })
  })

  it('rejects option ids that do not belong to the poll', async () => {
    const state = await service.submit('p_vote', 'a:fingerprint', ['o_other'])

    expect(voteRepository.castVote).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      errorMessage: 'Invalid option',
    })
  })

  it('rejects multiple option ids for a single-choice poll', async () => {
    const state = await service.submit('p_vote', 'a:fingerprint', ['o_a', 'o_b'])

    expect(voteRepository.castVote).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      errorMessage: 'Multiple options not allowed',
    })
  })

  it('rejects duplicate option ids before writing vote rows', async () => {
    definitionRepository.findByPollId.mockResolvedValue({
      ...openPoll,
      mode: 'multiple',
    })

    const state = await service.submit('p_vote', 'a:fingerprint', ['o_a', 'o_a'])

    expect(voteRepository.castVote).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'error',
      canVote: false,
      errorMessage: 'Duplicate option',
    })
  })

  it('accepts multiple option ids for a multiple-choice poll', async () => {
    definitionRepository.findByPollId.mockResolvedValue({
      ...openPoll,
      mode: 'multiple',
    })

    await service.submit('p_vote', 'a:fingerprint', ['o_a', 'o_b'])

    expect(voteRepository.castVote).toHaveBeenCalledWith({
      pollId: 'p_vote',
      voterFingerprint: 'a:fingerprint',
      optionIds: ['o_a', 'o_b'],
    })
  })
})

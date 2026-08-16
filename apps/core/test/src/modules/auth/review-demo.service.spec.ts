import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  REVIEW_DEMO_BAN_REASON,
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_HANDLE,
  REVIEW_DEMO_NAME,
} from '~/modules/auth/review-demo.constants'
import { ReviewDemoService } from '~/modules/auth/review-demo.service'

const DEMO_PASSWORD = 'generated-pass-1'
const DEMO_ID = 'demo-reader-1'
const ACCOUNT_ID = 'demo-account-1'

function demoReader(overrides?: Record<string, unknown>) {
  return {
    id: DEMO_ID,
    email: REVIEW_DEMO_EMAIL,
    emailVerified: true,
    name: REVIEW_DEMO_NAME,
    handle: REVIEW_DEMO_HANDLE,
    username: REVIEW_DEMO_HANDLE,
    displayUsername: REVIEW_DEMO_NAME,
    image: null,
    role: 'reader',
    bannedAt: null,
    banReason: null,
    ...overrides,
  }
}

function createHarness(options?: {
  enabled?: boolean
  password?: string
  reader?: ReturnType<typeof demoReader> | null
  accounts?: Array<{ id: string; providerId: string }>
  disablePasswordLogin?: boolean
}) {
  const oauth = {
    public: {
      apple: {
        reviewDemoEnabled: options?.enabled === false ? '' : 'true',
      },
    },
    secrets: {
      apple: {
        ...(options?.password ? { reviewDemoPassword: options.password } : {}),
      },
    },
  }
  const configsService = {
    get: vi.fn(async (key: string) => {
      if (key === 'oauth') return oauth
      if (key === 'authSecurity') {
        return { disablePasswordLogin: options?.disablePasswordLogin ?? false }
      }
      return {}
    }),
    patchAndValid: vi.fn(
      async (_key: string, value: { secrets?: typeof oauth.secrets }) => {
        if (value.secrets?.apple) {
          oauth.secrets.apple = {
            ...oauth.secrets.apple,
            ...value.secrets.apple,
          }
        }
        return oauth
      },
    ),
  }
  const readerRepository = {
    findByEmail: vi
      .fn()
      .mockResolvedValue(options?.reader === undefined ? null : options.reader),
    create: vi.fn().mockResolvedValue(demoReader()),
    update: vi.fn(),
    setBanned: vi.fn(),
    unsetBanned: vi.fn(),
    deleteSessionsForUser: vi.fn(),
  }
  const authRepository = {
    createAccount: vi.fn(),
    findAccountsForUser: vi.fn().mockResolvedValue(options?.accounts ?? []),
    updateAccountPassword: vi.fn(),
  }
  const commentService = {
    softDeleteComment: vi.fn(),
  }
  const commentRepository = {
    findByFilter: vi.fn().mockResolvedValue([]),
  }
  const pollVoteRepository = {
    deleteByFingerprint: vi.fn().mockResolvedValue(0),
  }
  const snowflakeService = {
    nextId: vi
      .fn()
      .mockReturnValueOnce(DEMO_ID)
      .mockReturnValueOnce(ACCOUNT_ID),
  }
  const service = new ReviewDemoService(
    configsService as any,
    readerRepository as any,
    authRepository as any,
    snowflakeService as any,
    commentService as any,
    commentRepository as any,
    pollVoteRepository as any,
  )
  vi.spyOn(service, 'generatePassword').mockReturnValue(DEMO_PASSWORD)
  return {
    authRepository,
    commentRepository,
    commentService,
    configsService,
    oauth,
    pollVoteRepository,
    readerRepository,
    service,
    snowflakeService,
  }
}

describe('ReviewDemoService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a reader and credential when the toggle is on and no account exists', async () => {
    const { authRepository, configsService, readerRepository, service } =
      createHarness({ enabled: true })

    await service.sync()

    expect(readerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: DEMO_ID,
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        name: REVIEW_DEMO_NAME,
        handle: REVIEW_DEMO_HANDLE,
        username: REVIEW_DEMO_HANDLE,
        displayUsername: REVIEW_DEMO_NAME,
        role: 'reader',
      }),
    )
    expect(authRepository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ACCOUNT_ID,
        providerAccountId: DEMO_ID,
        providerId: 'credential',
        userId: DEMO_ID,
      }),
    )
    expect(configsService.patchAndValid).toHaveBeenCalledWith('oauth', {
      secrets: { apple: { reviewDemoPassword: DEMO_PASSWORD } },
    })
  })

  it('does not recreate or rotate when the demo reader already exists', async () => {
    const { authRepository, configsService, readerRepository, service } =
      createHarness({
        enabled: true,
        password: 'kept-password',
        reader: demoReader(),
        accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
      })

    await service.sync()

    expect(readerRepository.create).not.toHaveBeenCalled()
    expect(authRepository.createAccount).not.toHaveBeenCalled()
    expect(authRepository.updateAccountPassword).not.toHaveBeenCalled()
    expect(configsService.patchAndValid).not.toHaveBeenCalled()
  })

  it('unbans and restores the default profile when re-enabled', async () => {
    const { configsService, readerRepository, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      reader: demoReader({
        bannedAt: new Date('2026-01-01'),
        banReason: REVIEW_DEMO_BAN_REASON,
        name: 'Changed',
        image: 'https://example.com/x.png',
      }),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(readerRepository.unsetBanned).toHaveBeenCalledWith(DEMO_ID)
    expect(readerRepository.update).toHaveBeenCalledWith(DEMO_ID, {
      name: REVIEW_DEMO_NAME,
      displayUsername: REVIEW_DEMO_NAME,
      image: null,
    })
    expect(configsService.patchAndValid).not.toHaveBeenCalled()
  })

  it('bans the demo reader and clears sessions when the toggle is off', async () => {
    const { readerRepository, service } = createHarness({
      enabled: false,
      password: 'kept-password',
      reader: demoReader(),
    })

    await service.sync()

    expect(readerRepository.setBanned).toHaveBeenCalledWith(DEMO_ID, {
      bannedAt: expect.any(Date),
      banReason: REVIEW_DEMO_BAN_REASON,
    })
    expect(readerRepository.deleteSessionsForUser).toHaveBeenCalledWith(DEMO_ID)
    expect(readerRepository.create).not.toHaveBeenCalled()
  })

  it('does not overwrite a non-demo occupant of the reserved email', async () => {
    const { authRepository, readerRepository, service } = createHarness({
      enabled: true,
      reader: demoReader({
        handle: 'someone-else',
        username: 'someone-else',
      }),
    })

    await service.sync()

    expect(readerRepository.create).not.toHaveBeenCalled()
    expect(authRepository.createAccount).not.toHaveBeenCalled()
    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      error: 'provision_failed',
    })
  })

  it('regenerates a missing password onto an existing credential account', async () => {
    const { authRepository, configsService, service } = createHarness({
      enabled: true,
      reader: demoReader(),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(configsService.patchAndValid).toHaveBeenCalledWith('oauth', {
      secrets: { apple: { reviewDemoPassword: DEMO_PASSWORD } },
    })
    expect(authRepository.updateAccountPassword).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.any(String),
    )
    expect(authRepository.createAccount).not.toHaveBeenCalled()
  })

  it('maps disablePasswordLogin and bannedAt into the sign-in gate', async () => {
    const { service } = createHarness({
      enabled: true,
      password: 'kept-password',
      reader: demoReader({ bannedAt: new Date() }),
      disablePasswordLogin: true,
    })

    await expect(service.getEmailSignInGate()).resolves.toEqual({
      disablePasswordLogin: true,
      reviewDemoEnabled: true,
      reviewDemoBanned: true,
    })
  })

  it('skips daily reset when the toggle is off', async () => {
    const { commentService, pollVoteRepository, service } = createHarness({
      enabled: false,
      password: 'kept-password',
      reader: demoReader(),
    })

    await expect(service.resetDaily()).resolves.toEqual({ skipped: true })
    expect(commentService.softDeleteComment).not.toHaveBeenCalled()
    expect(pollVoteRepository.deleteByFingerprint).not.toHaveBeenCalled()
  })

  it('soft-deletes comments, poll votes, and restores the default profile', async () => {
    const {
      commentRepository,
      commentService,
      pollVoteRepository,
      readerRepository,
      service,
    } = createHarness({
      enabled: true,
      password: 'kept-password',
      reader: demoReader({
        name: 'Changed',
        image: 'https://example.com/x.png',
      }),
    })
    commentRepository.findByFilter.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
    ])
    pollVoteRepository.deleteByFingerprint.mockResolvedValue(3)

    await expect(service.resetDaily()).resolves.toEqual({
      comments: 2,
      pollVotes: 3,
    })
    expect(commentService.softDeleteComment).toHaveBeenCalledWith('c1')
    expect(commentService.softDeleteComment).toHaveBeenCalledWith('c2')
    expect(pollVoteRepository.deleteByFingerprint).toHaveBeenCalledWith(
      `r:${DEMO_ID}`,
    )
    expect(readerRepository.update).toHaveBeenCalledWith(DEMO_ID, {
      name: REVIEW_DEMO_NAME,
      displayUsername: REVIEW_DEMO_NAME,
      image: null,
    })
    expect(readerRepository.deleteSessionsForUser).not.toHaveBeenCalled()
  })
})

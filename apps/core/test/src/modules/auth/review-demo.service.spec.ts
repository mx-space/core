import { verifyPassword } from 'better-auth/crypto'
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

type DemoAccount = {
  id: string
  password?: string
  providerAccountId?: string
  providerId: string
  userId?: string
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function createAdvisoryPool() {
  let lockTail = Promise.resolve()
  return {
    connect: vi.fn(async () => {
      let releaseLock = () => {}
      return {
        query: vi.fn(async (statement: string) => {
          if (statement.includes('pg_advisory_lock')) {
            const previousLock = lockTail
            lockTail = new Promise<void>((resolve) => {
              releaseLock = resolve
            })
            await previousLock
          }
          if (statement.includes('pg_advisory_unlock')) {
            releaseLock()
          }
          return { rows: [] }
        }),
        release: vi.fn(),
      }
    }),
  }
}

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
  readerId?: string
  usernameHolder?: { id: string; username: string } | null
  accounts?: DemoAccount[]
  disablePasswordLogin?: boolean
}) {
  let reader = options?.reader === undefined ? null : options.reader
  const accounts = [...(options?.accounts ?? [])]
  const oauth = {
    public: {
      apple: {
        reviewDemoEnabled: options?.enabled === false ? '' : 'true',
      },
    },
    secrets: {
      apple: {
        ...(options?.password ? { reviewDemoPassword: options.password } : {}),
        ...(options?.readerId ? { reviewDemoReaderId: options.readerId } : {}),
      } as Record<string, string>,
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
    findByEmail: vi.fn(async () => reader),
    findByUsername: vi.fn(async (username: string) => {
      if (options?.usernameHolder?.username === username) {
        return options.usernameHolder
      }
      return reader?.username === username ? reader : null
    }),
    create: vi.fn(async (input: ReturnType<typeof demoReader>) => {
      reader = demoReader(input)
      return reader
    }),
    update: vi.fn(
      async (_id: string, patch: Partial<ReturnType<typeof demoReader>>) => {
        if (!reader) return null
        reader = { ...reader, ...patch }
        return reader
      },
    ),
    setBanned: vi.fn(
      async (_id: string, patch: { bannedAt: Date; banReason: string }) => {
        if (!reader) return null
        reader = { ...reader, ...patch }
        return reader
      },
    ),
    unsetBanned: vi.fn(async () => {
      if (!reader) return null
      reader = { ...reader, bannedAt: null, banReason: null }
      return reader
    }),
    deleteSessionsForUser: vi.fn(),
  }
  const authRepository = {
    createAccount: vi.fn(async (account: DemoAccount) => {
      accounts.push(account)
      return account
    }),
    findAccountsForUser: vi.fn(async () => accounts),
    updateAccountPassword: vi.fn(async (id: string, password: string) => {
      const account = accounts.find((item) => item.id === id)
      if (account) account.password = password
    }),
  }
  const commentService = {
    softDeleteComment: vi.fn(),
  }
  const commentRepository = {
    paginatedFind: vi.fn().mockResolvedValue({ data: [] }),
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
  const postgresClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
  const postgresPool = {
    connect: vi.fn().mockResolvedValue(postgresClient),
  }
  const service = new ReviewDemoService(
    configsService as any,
    readerRepository as any,
    authRepository as any,
    snowflakeService as any,
    commentService as any,
    commentRepository as any,
    pollVoteRepository as any,
    postgresPool as any,
  )
  vi.spyOn(service, 'generatePassword').mockReturnValue(DEMO_PASSWORD)
  return {
    authRepository,
    commentRepository,
    commentService,
    configsService,
    getReader: () => reader,
    oauth,
    pollVoteRepository,
    readerRepository,
    service,
    setEnabled: (enabled: boolean) => {
      oauth.public.apple.reviewDemoEnabled = enabled ? 'true' : ''
    },
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
      secrets: {
        apple: {
          reviewDemoPassword: DEMO_PASSWORD,
          reviewDemoReaderId: DEMO_ID,
        },
      },
    })
  })

  it('does not recreate or rotate when the demo reader already exists', async () => {
    const { authRepository, configsService, readerRepository, service } =
      createHarness({
        enabled: true,
        password: 'kept-password',
        reader: demoReader(),
        readerId: DEMO_ID,
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
      readerId: DEMO_ID,
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
    expect(readerRepository.update).toHaveBeenCalledWith(
      DEMO_ID,
      expect.objectContaining({
        displayUsername: REVIEW_DEMO_NAME,
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        handle: REVIEW_DEMO_HANDLE,
        image: null,
        name: REVIEW_DEMO_NAME,
        role: 'reader',
        username: REVIEW_DEMO_HANDLE,
      }),
    )
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

  it('restores immutable identity fields for the reserved email', async () => {
    const { authRepository, readerRepository, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      readerId: DEMO_ID,
      reader: demoReader({
        handle: 'someone-else',
        role: 'owner',
        username: 'someone-else',
      }),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(readerRepository.create).not.toHaveBeenCalled()
    expect(authRepository.createAccount).not.toHaveBeenCalled()
    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      password: 'kept-password',
    })
    expect(readerRepository.update).toHaveBeenCalledWith(
      DEMO_ID,
      expect.objectContaining({
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        handle: REVIEW_DEMO_HANDLE,
        role: 'reader',
        username: REVIEW_DEMO_HANDLE,
      }),
    )
  })

  it('regenerates a missing password onto an existing credential account', async () => {
    const { authRepository, configsService, service } = createHarness({
      enabled: true,
      reader: demoReader(),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(configsService.patchAndValid).toHaveBeenCalledWith('oauth', {
      secrets: {
        apple: {
          reviewDemoPassword: DEMO_PASSWORD,
          reviewDemoReaderId: DEMO_ID,
        },
      },
    })
    expect(authRepository.updateAccountPassword).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.any(String),
    )
    expect(authRepository.createAccount).not.toHaveBeenCalled()
  })

  it('adopts a legacy provisioned reader and records its id', async () => {
    const { oauth, readerRepository, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      reader: demoReader(),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(oauth.secrets.apple.reviewDemoReaderId).toBe(DEMO_ID)
    expect(readerRepository.create).not.toHaveBeenCalled()
  })

  it('refuses to take over a foreign account holding the reserved email', async () => {
    const foreign = demoReader({
      id: 'foreign-1',
      handle: 'real-person',
      role: 'owner',
      username: 'real-person',
    })
    const {
      authRepository,
      configsService,
      getReader,
      readerRepository,
      service,
    } = createHarness({
      enabled: true,
      reader: foreign,
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()

    expect(readerRepository.update).not.toHaveBeenCalled()
    expect(readerRepository.create).not.toHaveBeenCalled()
    expect(authRepository.updateAccountPassword).not.toHaveBeenCalled()
    expect(configsService.patchAndValid).not.toHaveBeenCalled()
    expect(getReader()).toMatchObject({ id: 'foreign-1', role: 'owner' })
    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      error: 'provision_failed',
    })
  })

  it('refuses to provision when the reserved username is taken', async () => {
    const { authRepository, configsService, readerRepository, service } =
      createHarness({
        enabled: true,
        usernameHolder: { id: 'foreign-2', username: REVIEW_DEMO_HANDLE },
      })

    await service.sync()

    expect(readerRepository.create).not.toHaveBeenCalled()
    expect(authRepository.createAccount).not.toHaveBeenCalled()
    expect(configsService.patchAndValid).not.toHaveBeenCalled()
    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      error: 'provision_failed',
    })
  })

  it('reports provision_failed instead of throwing when sync fails', async () => {
    const { readerRepository, service } = createHarness({ enabled: true })
    readerRepository.findByEmail.mockRejectedValueOnce(new Error('db down'))

    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      error: 'provision_failed',
    })
  })

  it('preserves a manual ban while reading the sign-in gate and credentials', async () => {
    const { getReader, readerRepository, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      reader: demoReader({
        bannedAt: new Date(),
        banReason: 'manual-abuse-ban',
      }),
      disablePasswordLogin: true,
    })

    await expect(service.getCredentialSignInGate()).resolves.toEqual({
      disablePasswordLogin: true,
      reviewDemoEnabled: true,
      reviewDemoBanned: true,
    })
    await expect(service.getCredentials()).resolves.toEqual({
      enabled: true,
      email: REVIEW_DEMO_EMAIL,
      error: 'provision_failed',
    })
    expect(readerRepository.unsetBanned).not.toHaveBeenCalled()
    expect(getReader()?.banReason).toBe('manual-abuse-ban')
  })

  it('unbans only the service ban across an off-to-on transition', async () => {
    const { getReader, oauth, readerRepository, service, setEnabled } =
      createHarness({
        enabled: false,
        password: 'kept-password',
        reader: demoReader(),
        accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
      })

    await service.sync()
    expect(getReader()).toMatchObject({
      id: DEMO_ID,
      banReason: REVIEW_DEMO_BAN_REASON,
    })

    setEnabled(true)
    await service.sync()

    expect(readerRepository.unsetBanned).toHaveBeenCalledWith(DEMO_ID)
    expect(getReader()).toMatchObject({
      id: DEMO_ID,
      bannedAt: null,
      banReason: null,
    })
    expect(oauth.secrets.apple.reviewDemoPassword).toBe('kept-password')
  })

  it('keeps the generated identity and password through disable and re-enable', async () => {
    const {
      authRepository,
      getReader,
      oauth,
      readerRepository,
      service,
      setEnabled,
    } = createHarness({ enabled: true })

    await service.sync()
    const readerId = getReader()?.id
    const password = oauth.secrets.apple.reviewDemoPassword
    setEnabled(false)
    await service.sync()
    setEnabled(true)
    await service.sync()

    expect(getReader()?.id).toBe(readerId)
    expect(oauth.secrets.apple.reviewDemoPassword).toBe(password)
    expect(service.generatePassword).toHaveBeenCalledOnce()
    expect(readerRepository.create).toHaveBeenCalledOnce()
    expect(authRepository.createAccount).toHaveBeenCalledOnce()
  })

  it('keeps a manual ban across an off-to-on transition', async () => {
    const { getReader, readerRepository, service, setEnabled } = createHarness({
      enabled: false,
      password: 'kept-password',
      reader: demoReader({
        bannedAt: new Date(),
        banReason: 'manual-abuse-ban',
      }),
      accounts: [{ id: ACCOUNT_ID, providerId: 'credential' }],
    })

    await service.sync()
    setEnabled(true)
    await service.sync()

    expect(readerRepository.setBanned).not.toHaveBeenCalled()
    expect(readerRepository.unsetBanned).not.toHaveBeenCalled()
    expect(getReader()?.banReason).toBe('manual-abuse-ban')
  })

  it('coalesces overlapping sync calls and reruns with the latest toggle', async () => {
    const started = createDeferred()
    const release = createDeferred()
    const { configsService, getReader, readerRepository, service, setEnabled } =
      createHarness({ enabled: true })
    const currentGet = configsService.get.getMockImplementation()!
    configsService.get.mockImplementationOnce(async (key: string) => {
      const value = structuredClone(await currentGet(key))
      started.resolve()
      await release.promise
      return value
    })

    const firstSync = service.sync()
    await started.promise
    setEnabled(false)
    const secondSync = service.sync()

    expect(secondSync).toBe(firstSync)
    release.resolve()
    await secondSync

    expect(readerRepository.create).toHaveBeenCalledOnce()
    expect(readerRepository.setBanned).toHaveBeenCalledWith(DEMO_ID, {
      bannedAt: expect.any(Date),
      banReason: REVIEW_DEMO_BAN_REASON,
    })
    expect(readerRepository.deleteSessionsForUser).toHaveBeenCalledWith(DEMO_ID)
    expect(getReader()?.banReason).toBe(REVIEW_DEMO_BAN_REASON)
  })

  it('serializes provisioning across service instances with the advisory lock', async () => {
    const pool = createAdvisoryPool()
    const oauth = {
      public: { apple: { reviewDemoEnabled: 'true' } },
      secrets: { apple: {} as Record<string, string> },
    }
    let reader: ReturnType<typeof demoReader> | null = null
    const accounts: DemoAccount[] = []
    const configsService = {
      get: vi.fn(async () => oauth),
      patchAndValid: vi.fn(
        async (
          _key: string,
          value: { secrets: { apple: Record<string, string> } },
        ) => {
          Object.assign(oauth.secrets.apple, value.secrets.apple)
          return oauth
        },
      ),
    }
    const readerRepository = {
      create: vi.fn(async (input: ReturnType<typeof demoReader>) => {
        reader = demoReader(input)
        return reader
      }),
      deleteSessionsForUser: vi.fn(),
      findByEmail: vi.fn(async () => reader),
      findByUsername: vi.fn(async (username: string) =>
        reader?.username === username ? reader : null,
      ),
      setBanned: vi.fn(),
      unsetBanned: vi.fn(),
      update: vi.fn(),
    }
    const authRepository = {
      createAccount: vi.fn(async (account: DemoAccount) => {
        accounts.push(account)
        return account
      }),
      findAccountsForUser: vi.fn(async () => accounts),
      updateAccountPassword: vi.fn(),
    }
    const firstSnowflake = {
      nextId: vi
        .fn()
        .mockReturnValueOnce('reader-a')
        .mockReturnValueOnce('account-a'),
    }
    const secondSnowflake = {
      nextId: vi
        .fn()
        .mockReturnValueOnce('reader-b')
        .mockReturnValueOnce('account-b'),
    }
    const commentService = { softDeleteComment: vi.fn() }
    const commentRepository = { paginatedFind: vi.fn() }
    const pollVoteRepository = { deleteByFingerprint: vi.fn() }
    const firstService = new ReviewDemoService(
      configsService as any,
      readerRepository as any,
      authRepository as any,
      firstSnowflake as any,
      commentService as any,
      commentRepository as any,
      pollVoteRepository as any,
      pool,
    )
    const secondService = new ReviewDemoService(
      configsService as any,
      readerRepository as any,
      authRepository as any,
      secondSnowflake as any,
      commentService as any,
      commentRepository as any,
      pollVoteRepository as any,
      pool,
    )
    vi.spyOn(firstService, 'generatePassword').mockReturnValue('password-a')
    vi.spyOn(secondService, 'generatePassword').mockReturnValue('password-b')

    await Promise.all([firstService.sync(), secondService.sync()])

    expect(configsService.patchAndValid).toHaveBeenCalledOnce()
    expect(readerRepository.create).toHaveBeenCalledOnce()
    expect(authRepository.createAccount).toHaveBeenCalledOnce()
    const password = oauth.secrets.apple.reviewDemoPassword
    expect(['password-a', 'password-b']).toContain(password)
    await expect(
      verifyPassword({ hash: accounts[0].password!, password }),
    ).resolves.toBe(true)
    expect(accounts[0].userId).toBe(reader?.id)
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
        handle: 'changed-handle',
        name: 'Changed',
        image: 'https://example.com/x.png',
        username: 'changed-username',
      }),
    })
    commentRepository.paginatedFind.mockResolvedValue({
      data: [{ id: 'c1' }, { id: 'c2' }],
    })
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

  it('sweeps comments in batches until the reader has none left', async () => {
    const { commentRepository, commentService, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      readerId: DEMO_ID,
      reader: demoReader(),
    })
    const remaining = Array.from({ length: 120 }, (_, index) => ({
      id: `c${index}`,
    }))
    commentRepository.paginatedFind.mockImplementation(async () => ({
      data: remaining.slice(0, 50),
    }))
    commentService.softDeleteComment.mockImplementation(async (id: string) => {
      const index = remaining.findIndex((comment) => comment.id === id)
      if (index >= 0) remaining.splice(index, 1)
    })

    await expect(service.resetDaily()).resolves.toMatchObject({ comments: 120 })
    expect(commentRepository.paginatedFind).toHaveBeenCalledWith(
      { readerId: DEMO_ID, isDeleted: false },
      1,
      50,
    )
    expect(commentService.softDeleteComment).toHaveBeenCalledTimes(120)
  })

  it('aborts the sweep when a batch stops shrinking', async () => {
    const { commentRepository, commentService, service } = createHarness({
      enabled: true,
      password: 'kept-password',
      readerId: DEMO_ID,
      reader: demoReader(),
    })
    const stuck = Array.from({ length: 50 }, (_, index) => ({
      id: `stuck-${index}`,
    }))
    commentRepository.paginatedFind.mockResolvedValue({ data: stuck })

    await expect(service.resetDaily()).resolves.toMatchObject({ comments: 50 })
    expect(commentService.softDeleteComment).toHaveBeenCalledTimes(50)
  })
})

import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { approve } from '../../../src/cli/comment/approve'
import { del } from '../../../src/cli/comment/delete'
import { list } from '../../../src/cli/comment/list'
import { reject } from '../../../src/cli/comment/reject'
import { unread } from '../../../src/cli/comment/unread'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import { Comment } from '../../../src/services/Comment'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { testHttpLayer } from '../../helper/test-http'

const resolved: ResolvedConfig = {
  apiUrl: 'https://blog.example.com',
  apiBase: 'https://blog.example.com/api/v2',
  authBase: 'https://blog.example.com/api/v2/auth',
  apiVersion: 2,
  clientId: 'mxs-cli',
  configPath: '/tmp/config.json',
  credentialsPath: '/tmp/credentials.json',
  profileName: 'dev',
  isProduction: false,
  profileExplicit: false,
  urlOverridden: false,
}

const noopConfig: ConfigService = {
  getConfigDir: Effect.succeed('/tmp'),
  getProfilesDir: Effect.succeed('/tmp/profiles'),
  getProfileDir: (n) => Effect.succeed(`/tmp/profiles/${n}`),
  getProfileConfigPath: (n) => Effect.succeed(`/tmp/${n}/config.json`),
  getProfileCredentialsPath: (n) => Effect.succeed(`/tmp/${n}/cred.json`),
  getCurrentPath: Effect.succeed('/tmp/current'),
  getLegacyConfigPath: Effect.succeed('/tmp/config.json'),
  getLegacyCredentialsPath: Effect.succeed('/tmp/credentials.json'),
  readProfileConfig: () => Effect.succeed({}),
  writeProfileConfig: () => Effect.void,
  updateProfileConfig: () => Effect.succeed({}),
  readProfileCredentials: () => Effect.succeed(null),
  writeProfileCredentials: () => Effect.void,
  deleteProfileCredentials: () => Effect.void,
  readLegacyConfig: Effect.succeed({}),
  readLegacyConfigRaw: Effect.succeed(null),
  readLegacyCredentialsRaw: Effect.succeed(null),
  deleteLegacyConfig: Effect.void,
  deleteLegacyCredentials: Effect.void,
  readCurrent: Effect.succeed(resolved.profileName),
  writeCurrent: () => Effect.void,
  listProfileDirs: Effect.succeed([]),
  profileExists: () => Effect.succeed(true),
  removeProfileDir: () => Effect.void,
  resolve: () => Effect.succeed(resolved),
}

const noopAuth: AuthService = {
  probe: () => Effect.die('probe not used'),
  requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
  pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
  refresh: () => Effect.succeed(null),
  login: () => Effect.die('login not used'),
  logout: () => Effect.void,
  whoami: Effect.die('whoami not used'),
  status: Effect.die('status not used'),
  ensureFresh: (r) =>
    Effect.succeed({
      access_token: r.token ?? '',
      expires_at: Date.now() + 3600_000,
    }),
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
}

const buildLayer = (httpLayer: Layer.Layer<any>) =>
  Layer.mergeAll(
    Comment.Default.pipe(
      Layer.provide(
        Api.Default.pipe(
          Layer.provide(Layer.succeed(Config, noopConfig)),
          Layer.provide(Layer.succeed(Auth, noopAuth)),
          Layer.provide(httpLayer),
        ),
      ),
    ),
    Api.Default.pipe(
      Layer.provide(Layer.succeed(Config, noopConfig)),
      Layer.provide(Layer.succeed(Auth, noopAuth)),
      Layer.provide(httpLayer),
    ),
    Renderer.Default,
  )

const muteStdout = (): { restore: () => void; chunks: string[] } => {
  const chunks: string[] = []
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((c: any) => (chunks.push(String(c)), true))
  return { chunks, restore: () => spy.mockRestore() }
}

const setStdinTty = (value: boolean) => {
  const original = process.stdin.isTTY
  Object.defineProperty(process.stdin, 'isTTY', {
    value,
    configurable: true,
  })
  return () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: original,
      configurable: true,
    })
  }
}

describe('comment list', () => {
  it('defaults to state=unread (0) and passes page/size', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/comments?page=2&size=5&state=0': {
        status: 200,
        body: { data: [{ id: 'c1', author: 'alice', text: 'hi', state: 0 }] },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = list.handler({
        page: Option.some(2),
        size: Option.some(5),
        state: Option.none(),
        all: false,
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(1)
      expect(out.chunks.join('')).toContain('alice')
    } finally {
      out.restore()
    }
  })

  it('--all aggregates three state queries', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/comments?state=0': {
        status: 200,
        body: { data: [{ id: 'u1', state: 0 }], pagination: { total: 1 } },
      },
      'GET https://blog.example.com/api/v2/comments?state=1': {
        status: 200,
        body: { data: [{ id: 'r1', state: 1 }], pagination: { total: 2 } },
      },
      'GET https://blog.example.com/api/v2/comments?state=2': {
        status: 200,
        body: { data: [{ id: 'j1', state: 2 }], pagination: { total: 3 } },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = list.handler({
        page: Option.none(),
        size: Option.none(),
        state: Option.none(),
        all: true,
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(3)
      const out_ = out.chunks.join('')
      expect(out_).toContain('u1')
      expect(out_).toContain('r1')
      expect(out_).toContain('j1')
    } finally {
      out.restore()
    }
  })
})

describe('comment unread alias', () => {
  it('issues GET /comments with state=0 and forwards paging', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/comments?page=3&size=20&state=0': {
        status: 200,
        body: { data: [{ id: 'u9', state: 0 }] },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = unread.handler({
        page: Option.some(3),
        size: Option.some(20),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(1)
      expect(out.chunks.join('')).toContain('u9')
    } finally {
      out.restore()
    }
  })
})

describe('comment approve', () => {
  it('routes single id through PATCH /comments/batch/state with state=1', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/comments/batch/state': {
        status: 200,
        body: { ok: true },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = approve.handler({
        ids: ['abc'],
        all: false,
        force: false,
        state: Option.none(),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(1)
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body).toMatchObject({ ids: ['abc'], state: 1 })
    } finally {
      out.restore()
    }
  })

  it('--all with --state forwards currentState=2 (junk)', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/comments/batch/state': {
        status: 200,
        body: { ok: true },
      },
    })
    const out = muteStdout()
    const restoreTty = setStdinTty(true)
    try {
      const layer = buildLayer(http.layer)
      const program = approve.handler({
        ids: [],
        all: true,
        force: false,
        state: Option.some('junk'),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body).toMatchObject({ all: true, state: 1, currentState: 2 })
    } finally {
      restoreTty()
      out.restore()
    }
  })

  it('rejects empty ids without --all', async () => {
    const http = testHttpLayer({})
    const layer = buildLayer(http.layer)
    const program = approve.handler({
      ids: [],
      all: false,
      force: false,
      state: Option.none(),
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, layer)),
    )
    expect(err._tag).toBe('ValidationFailed')
  })

  it('rejects ids combined with --all', async () => {
    const http = testHttpLayer({})
    const layer = buildLayer(http.layer)
    const program = approve.handler({
      ids: ['x'],
      all: true,
      force: false,
      state: Option.none(),
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, layer)),
    )
    expect(err._tag).toBe('ValidationFailed')
  })

  it('--all in non-TTY without --force is rejected', async () => {
    const http = testHttpLayer({})
    const layer = buildLayer(http.layer)
    const restoreTty = setStdinTty(false)
    try {
      const program = approve.handler({
        ids: [],
        all: true,
        force: false,
        state: Option.none(),
      })
      const err = await Effect.runPromise(
        Effect.flip(Effect.provide(program, layer)),
      )
      expect(err._tag).toBe('ValidationFailed')
    } finally {
      restoreTty()
    }
  })
})

describe('comment reject', () => {
  it('routes ids through PATCH batch/state with state=2 (junk)', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/comments/batch/state': {
        status: 200,
        body: { ok: true },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = reject.handler({
        ids: ['x', 'y'],
        all: false,
        force: false,
        state: Option.none(),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body).toMatchObject({ ids: ['x', 'y'], state: 2 })
    } finally {
      out.restore()
    }
  })
})

describe('comment delete', () => {
  it('single id in TTY routes through DELETE /comments/batch', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/comments/batch': {
        status: 200,
        body: { ok: true },
      },
    })
    const out = muteStdout()
    const restoreTty = setStdinTty(true)
    try {
      const layer = buildLayer(http.layer)
      const program = del.handler({
        ids: ['abc'],
        all: false,
        force: false,
        state: Option.none(),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body).toMatchObject({ ids: ['abc'] })
    } finally {
      restoreTty()
      out.restore()
    }
  })

  it('single id in non-TTY without --force is rejected', async () => {
    const http = testHttpLayer({})
    const layer = buildLayer(http.layer)
    const restoreTty = setStdinTty(false)
    try {
      const program = del.handler({
        ids: ['abc'],
        all: false,
        force: false,
        state: Option.none(),
      })
      const err = await Effect.runPromise(
        Effect.flip(Effect.provide(program, layer)),
      )
      expect(err._tag).toBe('ValidationFailed')
    } finally {
      restoreTty()
    }
  })

  it('--all with --state forwards state filter in DELETE body', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/comments/batch': {
        status: 200,
        body: { ok: true },
      },
    })
    const out = muteStdout()
    try {
      const layer = buildLayer(http.layer)
      const program = del.handler({
        ids: [],
        all: true,
        force: true,
        state: Option.some('junk'),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body).toMatchObject({ all: true, state: 2 })
    } finally {
      out.restore()
    }
  })
})

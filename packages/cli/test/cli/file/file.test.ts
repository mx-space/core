import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { del } from '../../../src/cli/file/delete'
import { list } from '../../../src/cli/file/list'
import { rename } from '../../../src/cli/file/rename'
import { upload } from '../../../src/cli/file/upload'
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
  getProfileDir: () => Effect.succeed('/tmp/profiles/dev'),
  getProfileConfigPath: () => Effect.succeed('/tmp/dev/config.json'),
  getProfileCredentialsPath: () => Effect.succeed('/tmp/dev/cred.json'),
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

const makeLayer = (http: ReturnType<typeof testHttpLayer>) => {
  const apiLayer = Api.Default.pipe(
    Layer.provide(Layer.succeed(Config, noopConfig)),
    Layer.provide(Layer.succeed(Auth, noopAuth)),
    Layer.provide(http.layer),
  )
  return Layer.mergeAll(apiLayer, Renderer.Default)
}

describe('file commands', () => {
  it('upload → POST /objects/upload?type=image with a multipart body', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mxs-file-'))
    const path = join(dir, 'pic.png')
    writeFileSync(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    let sawFormData = false
    let uploadedName = ''
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/objects/upload?type=image':
        async ({ request }) => {
          const body = request.body as {
            _tag: string
            formData?: FormData
          }
          sawFormData = body._tag === 'FormData'
          const file = body.formData?.get('file')
          if (file instanceof File) uploadedName = file.name
          return {
            status: 200,
            body: { url: 'https://cdn.example.com/pic.png', name: 'pic.png' },
          }
        },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = upload.handler({
        path,
        type: 'image',
        name: Option.none(),
        silent: false,
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(sawFormData).toBe(true)
      expect(uploadedName).toBe('pic.png')
    } finally {
      spy.mockRestore()
    }
  })

  it('upload of a missing file fails with Generic and sends nothing', async () => {
    const http = testHttpLayer({})
    const program = upload.handler({
      path: '/nonexistent/nope.png',
      type: 'file',
      name: Option.none(),
      silent: false,
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('Generic')
    expect(http.recorder.calls.length).toBe(0)
  })

  it('list → GET /objects/<type>', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/objects/image': {
        status: 200,
        body: [{ name: 'pic.png', url: 'https://cdn/pic.png', created: 1 }],
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = list.handler({ type: 'image' })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(http.recorder.calls[0]?.url).toBe(
        'https://blog.example.com/api/v2/objects/image',
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('delete --force → DELETE /objects/<type>/<name>', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/objects/file/a.zip': {
        status: 200,
        body: {},
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = del.handler({ name: 'a.zip', type: 'file', force: true })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(http.recorder.calls[0]?.method).toBe('DELETE')
    } finally {
      spy.mockRestore()
    }
  })

  it('rename → PATCH /objects/<type>/<name>/rename?newName=', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/objects/image/pic.png/rename?newName=cover.png':
        {
          status: 200,
          body: {},
        },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = rename.handler({
        name: 'pic.png',
        newName: 'cover.png',
        type: 'image',
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(http.recorder.calls[0]?.method).toBe('PATCH')
    } finally {
      spy.mockRestore()
    }
  })
})

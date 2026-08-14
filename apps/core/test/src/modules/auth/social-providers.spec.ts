import { generateKeyPairSync } from 'node:crypto'

import { decodeJwt } from 'jose'

import { buildSocialProviders } from '~/modules/auth/social-providers'
import type { OAuthConfig } from '~/modules/configs/configs.schema'

const SERVER_URL = 'https://api.innei.dev'

function createPrivateKeyPem() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return privateKey.export({ format: 'pem', type: 'pkcs8' }) as string
}

function appleConfig(overrides?: {
  publicFields?: Record<string, string>
  secrets?: Record<string, string>
}): OAuthConfig {
  return {
    providers: [{ enabled: true, type: 'apple' }],
    public: {
      apple: {
        clientId: 'dev.innei.service',
        ...overrides?.publicFields,
      },
    },
    secrets: {
      apple: {
        keyId: 'ABCD123456',
        privateKey: createPrivateKeyPem(),
        teamId: 'TEAM123456',
        ...overrides?.secrets,
      },
    },
  }
}

describe('buildSocialProviders', () => {
  it('skips disabled providers', () => {
    const providers = buildSocialProviders(
      {
        providers: [{ enabled: false, type: 'github' }],
        public: { github: { clientId: 'id' } },
        secrets: { github: { clientSecret: 'secret' } },
      },
      SERVER_URL,
    )

    expect(providers.github).toBeUndefined()
  })

  it('builds github and google from client id and secret', () => {
    const providers = buildSocialProviders(
      {
        providers: [
          { enabled: true, type: 'github' },
          { enabled: true, type: 'google' },
        ],
        public: { github: { clientId: 'gh' }, google: { clientId: 'gg' } },
        secrets: {
          github: { clientSecret: 'gh-secret' },
          google: { clientSecret: 'gg-secret' },
        },
      },
      SERVER_URL,
    )

    expect(providers.github).toMatchObject({
      clientId: 'gh',
      clientSecret: 'gh-secret',
      redirectURI: `${SERVER_URL}/auth/callback/github`,
    })
    expect(providers.google).toMatchObject({
      clientId: 'gg',
      clientSecret: 'gg-secret',
      redirectURI: `${SERVER_URL}/auth/callback/google`,
    })
  })

  it('skips a provider missing its credentials', () => {
    const providers = buildSocialProviders(
      {
        providers: [{ enabled: true, type: 'github' }],
        public: { github: { clientId: 'gh' } },
      },
      SERVER_URL,
    )

    expect(providers.github).toBeUndefined()
  })

  it('signs the apple client secret lazily on each resolve', async () => {
    const providers = buildSocialProviders(
      appleConfig({ publicFields: { appBundleIdentifier: 'dev.innei.app' } }),
      SERVER_URL,
    )

    expect(providers.apple).toBeTypeOf('function')

    const options = await (providers.apple as () => Promise<any>)()
    expect(options).toMatchObject({
      appBundleIdentifier: 'dev.innei.app',
      clientId: 'dev.innei.service',
      redirectURI: `${SERVER_URL}/auth/callback/apple`,
    })
    expect(decodeJwt(options.clientSecret)).toMatchObject({
      aud: 'https://appleid.apple.com',
      iss: 'TEAM123456',
      sub: 'dev.innei.service',
    })
  })

  it('omits appBundleIdentifier when it is blank', async () => {
    const providers = buildSocialProviders(
      appleConfig({ publicFields: { appBundleIdentifier: '' } }),
      SERVER_URL,
    )

    const options = await (providers.apple as () => Promise<any>)()
    expect(options.appBundleIdentifier).toBeUndefined()
  })

  it('skips apple when the signing key is incomplete', () => {
    const providers = buildSocialProviders(
      appleConfig({ secrets: { keyId: '' } }),
      SERVER_URL,
    )

    expect(providers.apple).toBeUndefined()
  })
})

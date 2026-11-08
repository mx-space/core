import { describe, expect, it } from 'vitest'

import {
  decryptObject,
  encryptObject,
} from '~/modules/configs/configs.encrypt.util'
import { normalizeLegacyConfig } from '~/modules/configs/legacy-config.util'
import { EncryptUtil } from '~/utils/encrypt.util'

describe('canonical legacy config conversion', () => {
  it('preserves populated legacy secrets when canonical fields are blank', () => {
    const value = normalizeLegacyConfig({
      membership: {
        apiKey: '',
        webhookSigningKey: '',
        dodoApiKey: 'billing-key',
        dodoWebhookKey: 'webhook-key',
      },
      thirdPartyServiceIntegration: {
        github: { enabled: true, token: '' },
        githubToken: 'github-key',
      },
    })
    expect(value.membership).toMatchObject({
      apiKey: 'billing-key',
      webhookSigningKey: 'webhook-key',
    })
    expect(value.thirdPartyServiceIntegration.github.token).toBe('github-key')
  })
  it('blocks conflicting populated secrets instead of choosing and deleting one', () => {
    expect(() =>
      normalizeLegacyConfig({
        membership: {
          apiKey: 'canonical-private',
          dodoApiKey: 'legacy-private',
        },
      }),
    ).toThrow('CONFIG_SECRET_CONFLICT')
    expect(() =>
      normalizeLegacyConfig({
        thirdPartyServiceIntegration: {
          github: { token: 'canonical-private' },
          githubToken: 'legacy-private',
        },
      }),
    ).toThrow('CONFIG_SECRET_CONFLICT')
  })
  it('moves decrypted legacy credentials and binds ciphertext to the new path', () => {
    const original = {
      thirdPartyServiceIntegration: {
        githubToken: EncryptUtil.encrypt(
          'github-secret',
          'thirdPartyServiceIntegration.githubToken',
        ),
      },
      membership: {
        dodoApiKey: EncryptUtil.encrypt(
          'billing-secret',
          'membership.dodoApiKey',
        ),
      },
      imageGenerationOptions: {
        apiKey: EncryptUtil.encrypt(
          'image-secret',
          'imageGenerationOptions.apiKey',
        ),
        model: 'image-model',
        enable: true,
      },
    }
    const converted = normalizeLegacyConfig(
      decryptObject(structuredClone(original)),
    )
    expect(converted.thirdPartyServiceIntegration.github.token).toBe(
      'github-secret',
    )
    expect(converted.membership.apiKey).toBe('billing-secret')
    expect(converted.ai.providers[0].apiKey).toBe('image-secret')
    const persisted = encryptObject(structuredClone(converted))
    expect(
      EncryptUtil.decrypt(
        persisted.ai.providers[0].apiKey,
        'ai.providers.0.apiKey',
      ),
    ).toBe('image-secret')
    expect(persisted.membership).not.toHaveProperty('dodoApiKey')
    expect(persisted.thirdPartyServiceIntegration).not.toHaveProperty(
      'githubToken',
    )
    expect(normalizeLegacyConfig(converted)).toEqual(converted)
  })

  it('retains legacy media views from canonical AI configuration', () => {
    const config = normalizeLegacyConfig({
      imageGenerationOptions: {
        enable: true,
        apiKey: 'legacy-image',
        model: 'image-model',
        endpoint: 'https://api.example.com/v1',
      },
    })
    const {
      imageGenerationOptions: _image,
      ttsOptions: _speech,
      ...stored
    } = config
    expect(normalizeLegacyConfig(stored).imageGenerationOptions).toMatchObject({
      enable: true,
      apiKey: 'legacy-image',
      model: 'image-model',
      endpoint: 'https://api.example.com/v1',
    })
  })
  it('retains leftover media credentials alongside an already-v2 AI row', () => {
    const converted = normalizeLegacyConfig({
      ai: { version: 2, providers: [], imageGeneration: { enable: false } },
      imageGenerationOptions: {
        apiKey: 'retained-legacy-key',
        model: 'legacy-model',
        enable: true,
      },
    })
    expect(
      converted.ai.providers?.some(
        (provider) => provider.apiKey === 'retained-legacy-key',
      ),
    ).toBe(true)
    expect(converted.ai.imageGeneration?.enable).toBe(false)
  })
})

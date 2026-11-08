import { describe, expect, it } from 'vitest'

import {
  decryptObject,
  encryptObject,
} from '~/modules/configs/configs.encrypt.util'
import { normalizeLegacyConfig } from '~/modules/configs/legacy-config.util'
import { EncryptUtil } from '~/utils/encrypt.util'

describe('canonical legacy config conversion', () => {
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
})

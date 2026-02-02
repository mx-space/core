import {
  decryptObject,
  encryptObject,
  getExtractedEncryptedPaths,
  sanitizeConfigForResponse,
} from '~/modules/configs/configs.encrypt.util'

describe('encrypt.util', () => {
  test('should extract encrypted paths from schemas', () => {
    const paths = getExtractedEncryptedPaths()

    // Verify ALL encrypted paths are extracted
    expect(paths).toContain('mailOptions.smtp.pass')
    expect(paths).toContain('mailOptions.resend.apiKey')
    expect(paths).toContain('backupOptions.secretKey')
    expect(paths).toContain('imageStorageOptions.secretKey')
    expect(paths).toContain('baiduSearchOptions.token')
    expect(paths).toContain('bingSearchOptions.token')
    expect(paths).toContain('algoliaSearchOptions.apiKey')
    expect(paths).toContain('adminExtra.gaodemapKey')
    expect(paths).toContain('barkOptions.key')
    expect(paths).toContain('thirdPartyServiceIntegration.githubToken')
    expect(paths).toContain('ai.providers.*.apiKey')
    expect(paths).toContain('oauth.secrets.*.*')

    // Ensure exact count
    expect(paths.length).toBe(12)
  })
  describe('path-based encryption', () => {
    test('should encrypt mailOptions.smtp.pass', () => {
      const config = {
        smtp: { pass: 'my-smtp-password', user: 'user@example.com' },
      }

      const encrypted = encryptObject(config, 'mailOptions')

      expect(encrypted.smtp.pass).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.smtp.user).toBe('user@example.com')
    })

    test('should encrypt mailOptions.resend.apiKey', () => {
      const config = {
        resend: { apiKey: 're_123456' },
      }

      const encrypted = encryptObject(config, 'mailOptions')

      expect(encrypted.resend.apiKey).toMatch(/^\$\$\{mx\}\$\$/)
    })

    test('should decrypt mailOptions.smtp.pass', () => {
      const config = {
        smtp: { pass: 'my-secret-password', user: 'user@example.com' },
      }

      // First encrypt
      const encrypted = encryptObject({ ...config }, 'mailOptions')
      expect(encrypted.smtp.pass).toMatch(/^\$\$\{mx\}\$\$/)

      // Then decrypt
      const decrypted = decryptObject(encrypted, 'mailOptions')
      expect(decrypted.smtp.pass).toBe('my-secret-password')
      expect(decrypted.smtp.user).toBe('user@example.com')
    })

    test('should encrypt ai.providers.*.apiKey', () => {
      const config = {
        providers: [
          { id: 'openai', apiKey: 'sk-secret-key-1', name: 'OpenAI' },
          { id: 'anthropic', apiKey: 'sk-secret-key-2', name: 'Anthropic' },
        ],
        enableSummary: true,
      }

      const encrypted = encryptObject(config, 'ai')

      expect(encrypted.providers[0].apiKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.providers[0].id).toBe('openai')
      expect(encrypted.providers[0].name).toBe('OpenAI')
      expect(encrypted.providers[1].apiKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.enableSummary).toBe(true)
    })

    test('should encrypt backupOptions.secretKey', () => {
      const config = {
        enable: true,
        secretKey: 'my-s3-secret',
        secretId: 'my-s3-id',
        bucket: 'my-bucket',
      }

      const encrypted = encryptObject(config, 'backupOptions')

      expect(encrypted.secretKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.secretId).toBe('my-s3-id')
      expect(encrypted.bucket).toBe('my-bucket')
    })

    test('should encrypt imageStorageOptions.secretKey', () => {
      const config = {
        enable: true,
        secretKey: 'my-s3-secret',
        secretId: 'my-s3-id',
      }

      const encrypted = encryptObject(config, 'imageStorageOptions')

      expect(encrypted.secretKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.secretId).toBe('my-s3-id')
    })

    test('should encrypt baiduSearchOptions.token', () => {
      const config = {
        enable: true,
        token: 'baidu-push-token',
      }

      const encrypted = encryptObject(config, 'baiduSearchOptions')

      expect(encrypted.token).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.enable).toBe(true)
    })

    test('should encrypt bingSearchOptions.token', () => {
      const config = {
        enable: true,
        token: 'bing-api-key',
      }

      const encrypted = encryptObject(config, 'bingSearchOptions')

      expect(encrypted.token).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.enable).toBe(true)
    })

    test('should encrypt algoliaSearchOptions.apiKey', () => {
      const config = {
        enable: true,
        apiKey: 'algolia-api-key',
        appId: 'algolia-app-id',
        indexName: 'my-index',
      }

      const encrypted = encryptObject(config, 'algoliaSearchOptions')

      expect(encrypted.apiKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.appId).toBe('algolia-app-id')
      expect(encrypted.indexName).toBe('my-index')
    })

    test('should encrypt thirdPartyServiceIntegration.githubToken', () => {
      const config = {
        githubToken: 'ghp_xxxxxxxxxxxx',
      }

      const encrypted = encryptObject(config, 'thirdPartyServiceIntegration')

      expect(encrypted.githubToken).toMatch(/^\$\$\{mx\}\$\$/)
    })

    test('should encrypt adminExtra.gaodemapKey', () => {
      const config = {
        enableAdminProxy: true,
        gaodemapKey: 'gaode-api-key',
      }

      const encrypted = encryptObject(config, 'adminExtra')

      expect(encrypted.gaodemapKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.enableAdminProxy).toBe(true)
    })

    test('should encrypt barkOptions.key', () => {
      const config = {
        enable: true,
        key: 'bark-device-key',
        serverUrl: 'https://api.day.app',
      }

      const encrypted = encryptObject(config, 'barkOptions')

      expect(encrypted.key).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.enable).toBe(true)
      expect(encrypted.serverUrl).toBe('https://api.day.app')
    })

    test('should encrypt oauth.secrets', () => {
      const config = {
        providers: [{ type: 'github', enabled: true }],
        secrets: {
          github: {
            clientSecret: 'github-client-secret',
          },
        },
        public: {
          github: {
            clientId: 'github-client-id',
          },
        },
      }

      const encrypted = encryptObject(config, 'oauth')

      expect(encrypted.secrets.github.clientSecret).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.public.github.clientId).toBe('github-client-id')
    })

    test('should not encrypt unregistered paths', () => {
      const config = {
        title: 'My Site',
        description: 'A blog',
      }

      const encrypted = encryptObject(config, 'seo')

      expect(encrypted.title).toBe('My Site')
      expect(encrypted.description).toBe('A blog')
    })

    test('full config encryption and decryption', () => {
      const fullConfig = {
        mailOptions: {
          smtp: { pass: 'smtp-password', user: 'user@example.com' },
          resend: { apiKey: 're_123' },
        },
        backupOptions: {
          secretKey: 's3-secret',
          bucket: 'backup-bucket',
        },
        thirdPartyServiceIntegration: {
          githubToken: 'ghp_xxx',
        },
        seo: {
          title: 'My Site',
        },
      }

      const encrypted = encryptObject(fullConfig)

      expect(encrypted.mailOptions.smtp.pass).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.mailOptions.smtp.user).toBe('user@example.com')
      expect(encrypted.mailOptions.resend.apiKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.backupOptions.secretKey).toMatch(/^\$\$\{mx\}\$\$/)
      expect(encrypted.backupOptions.bucket).toBe('backup-bucket')
      expect(encrypted.thirdPartyServiceIntegration.githubToken).toMatch(
        /^\$\$\{mx\}\$\$/,
      )
      expect(encrypted.seo.title).toBe('My Site')

      const decrypted = decryptObject(encrypted)

      expect(decrypted.mailOptions.smtp.pass).toBe('smtp-password')
      expect(decrypted.mailOptions.smtp.user).toBe('user@example.com')
      expect(decrypted.mailOptions.resend.apiKey).toBe('re_123')
      expect(decrypted.backupOptions.secretKey).toBe('s3-secret')
      expect(decrypted.thirdPartyServiceIntegration.githubToken).toBe('ghp_xxx')
      expect(decrypted.seo.title).toBe('My Site')
    })
  })

  describe('sanitizeConfigForResponse', () => {
    test('should remove encrypted fields from mailOptions', () => {
      const config = {
        smtp: { pass: 'smtp-password', user: 'user@example.com' },
        resend: { apiKey: 're_123' },
      }

      const sanitized = sanitizeConfigForResponse(config, 'mailOptions')

      expect(sanitized.smtp.pass).toBe('')
      expect(sanitized.smtp.user).toBe('user@example.com')
      expect(sanitized.resend.apiKey).toBe('')
    })

    test('should remove encrypted fields from ai.providers', () => {
      const config = {
        providers: [
          { id: 'openai', apiKey: 'sk-secret-key', name: 'OpenAI' },
          { id: 'anthropic', apiKey: 'sk-another-key', name: 'Anthropic' },
        ],
        enableSummary: true,
      }

      const sanitized = sanitizeConfigForResponse(config, 'ai')

      expect(sanitized.providers[0].apiKey).toBe('')
      expect(sanitized.providers[0].id).toBe('openai')
      expect(sanitized.providers[0].name).toBe('OpenAI')
      expect(sanitized.providers[1].apiKey).toBe('')
      expect(sanitized.enableSummary).toBe(true)
    })

    test('should remove encrypted fields from oauth.secrets', () => {
      const config = {
        providers: [{ type: 'github', enabled: true }],
        secrets: {
          github: {
            clientSecret: 'github-secret',
          },
        },
        public: {
          github: {
            clientId: 'github-client-id',
          },
        },
      }

      const sanitized = sanitizeConfigForResponse(config, 'oauth')

      expect(sanitized.secrets.github.clientSecret).toBe('')
      expect(sanitized.public.github.clientId).toBe('github-client-id')
    })

    test('should not modify non-encrypted fields', () => {
      const config = {
        title: 'My Site',
        description: 'A blog',
      }

      const sanitized = sanitizeConfigForResponse(config, 'seo')

      expect(sanitized.title).toBe('My Site')
      expect(sanitized.description).toBe('A blog')
    })

    test('should sanitize full config', () => {
      const fullConfig = {
        mailOptions: {
          smtp: { pass: 'smtp-password', user: 'user@example.com' },
          resend: { apiKey: 're_123' },
        },
        backupOptions: {
          secretKey: 's3-secret',
          bucket: 'backup-bucket',
        },
        thirdPartyServiceIntegration: {
          githubToken: 'ghp_xxx',
        },
        seo: {
          title: 'My Site',
        },
      }

      const sanitized = sanitizeConfigForResponse(fullConfig)

      expect(sanitized.mailOptions.smtp.pass).toBe('')
      expect(sanitized.mailOptions.smtp.user).toBe('user@example.com')
      expect(sanitized.mailOptions.resend.apiKey).toBe('')
      expect(sanitized.backupOptions.secretKey).toBe('')
      expect(sanitized.backupOptions.bucket).toBe('backup-bucket')
      expect(sanitized.thirdPartyServiceIntegration.githubToken).toBe('')
      expect(sanitized.seo.title).toBe('My Site')
    })
  })
})

import { createPgTestDatabase } from 'test/helper/pg-verify-url'

import { AppMigrationsService } from '~/database/app-migrations/app-migrations.service'
import { OptionsRepository } from '~/modules/configs/options.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import { EncryptUtil } from '~/utils/encrypt.util'

const migrationId = '20261109-canonical-config'

it.each([false, true])(
  'preserves configured sibling integrations when converting a section without GitHub (legacy flat token=%s)',
  async (legacy) => {
    const context = await createPgTestDatabase('mx_integration_preservation', {
      configCurrent: false,
    })
    try {
      await context.pool.query(
        "INSERT INTO options (id,name,value) VALUES ('100','thirdPartyServiceIntegration',$1)",
        [
          {
            tmdb: {
              enabled: true,
              apiKey: EncryptUtil.encrypt(
                'existing-tmdb-private',
                'thirdPartyServiceIntegration.tmdb.apiKey',
              ),
            },
            bangumi: { enabled: true, accessToken: 'existing-bangumi-private' },
            ...(legacy ? { githubToken: 'imported-github-private' } : {}),
          },
        ],
      )
      await new AppMigrationsService(context.db, context.pool).run()
      const value = (
        await context.pool.query(
          "SELECT value FROM options WHERE name='thirdPartyServiceIntegration'",
        )
      ).rows[0].value
      expect(value.tmdb.enabled).toBe(true)
      expect(
        EncryptUtil.decrypt(
          value.tmdb.apiKey,
          'thirdPartyServiceIntegration.tmdb.apiKey',
        ),
      ).toBe('existing-tmdb-private')
      expect(
        EncryptUtil.decrypt(
          value.bangumi.accessToken,
          'thirdPartyServiceIntegration.bangumi.accessToken',
        ),
      ).toBe('existing-bangumi-private')
      expect(value).not.toHaveProperty('githubToken')
      if (legacy)
        expect(
          EncryptUtil.decrypt(
            value.github.token,
            'thirdPartyServiceIntegration.github.token',
          ),
        ).toBe('imported-github-private')
    } finally {
      await context.close()
    }
  },
)

it.each(['mailOptions', 'seo', 'backupOptions'])(
  'rejects malformed raw %s without defaulting away its contents',
  async (section) => {
    const context = await createPgTestDatabase('mx_raw_config_preservation', {
      configCurrent: false,
    })
    try {
      await context.pool.query(
        "INSERT INTO options (id,name,value) VALUES ('100',$1,$2),('101','membership',$3)",
        [
          section,
          JSON.stringify(['unknown-private-content']),
          { dodoApiKey: 'preserve-billing-private' },
        ],
      )
      const before = (
        await context.pool.query('SELECT * FROM options ORDER BY name')
      ).rows
      await expect(
        new AppMigrationsService(context.db, context.pool).run(),
      ).rejects.toThrow('CONFIG_SHAPE_UNSUPPORTED')
      expect(
        (await context.pool.query('SELECT * FROM options ORDER BY name')).rows,
      ).toEqual(before)
      expect(
        (
          await context.pool.query(
            'SELECT id FROM _app_migrations WHERE id=$1',
            [migrationId],
          )
        ).rowCount,
      ).toBe(0)
    } finally {
      await context.close()
    }
  },
)

it('blocks configuration startup until the release migration has completed, including a new installation', async () => {
  const context = await createPgTestDatabase('mx_config_guard', {
    configCurrent: false,
  })
  try {
    const repository = new OptionsRepository(context.db, new SnowflakeService())
    await expect(repository.findAll()).rejects.toThrow('migration')
    await new AppMigrationsService(context.db, context.pool).run()
    await expect(repository.findAll()).resolves.toEqual([])
  } finally {
    await context.close()
  }
})

it('automatically migrates old configuration rows before release startup and preserves credentials on rerun', async () => {
  const context = await createPgTestDatabase('mx_canonical_config', {
    configCurrent: false,
  })
  try {
    await context.pool.query(
      `INSERT INTO options (id,name,value) VALUES ('100','membership',$1), ('101','thirdPartyServiceIntegration',$2), ('102','imageGenerationOptions',$3), ('103','ttsOptions',$4)`,
      [
        {
          enabled: true,
          dodoApiKey: EncryptUtil.encrypt(
            'billing-private',
            'membership.dodoApiKey',
          ),
        },
        {
          githubToken: EncryptUtil.encrypt(
            'github-private',
            'thirdPartyServiceIntegration.githubToken',
          ),
        },
        {
          enable: true,
          apiKey: EncryptUtil.encrypt(
            'media-private',
            'imageGenerationOptions.apiKey',
          ),
          endpoint: 'https://api.example.test/v1',
          model: 'image-model',
        },
        {
          enable: true,
          apiKey: 'media-private',
          endpoint: 'https://api.example.test/v1',
          model: 'speech-model',
          voice: 'retained-voice',
        },
      ],
    )
    const runner = new AppMigrationsService(context.db, context.pool)
    await runner.run()
    const rows = (
      await context.pool.query('SELECT * FROM options ORDER BY name')
    ).rows
    const config = Object.fromEntries(rows.map((row) => [row.name, row.value]))
    expect(config).not.toHaveProperty('imageGenerationOptions')
    expect(config).not.toHaveProperty('ttsOptions')
    expect(config.membership).not.toHaveProperty('dodoApiKey')
    expect(
      EncryptUtil.decrypt(config.membership.apiKey, 'membership.apiKey'),
    ).toBe('billing-private')
    expect(
      EncryptUtil.decrypt(
        config.thirdPartyServiceIntegration.github.token,
        'thirdPartyServiceIntegration.github.token',
      ),
    ).toBe('github-private')
    expect(config.ai.providers).toHaveLength(1)
    expect(
      EncryptUtil.decrypt(
        config.ai.providers[0].apiKey,
        'ai.providers.0.apiKey',
      ),
    ).toBe('media-private')
    expect(config.ai.imageGeneration.model.model).toBe('image-model')
    expect(config.ai.tts).toMatchObject({
      enable: true,
      model: { model: 'speech-model' },
      voice: 'retained-voice',
    })
    expect(
      (
        await context.pool.query('SELECT id FROM _app_migrations WHERE id=$1', [
          migrationId,
        ])
      ).rowCount,
    ).toBe(1)
    await runner.run()
    expect(
      (await context.pool.query('SELECT * FROM options ORDER BY name')).rows,
    ).toEqual(rows)
  } finally {
    await context.close()
  }
})

it.each(['conflict', 'bad-ciphertext', 'bad-shape'])(
  'blocks release and rolls back every configuration row on %s',
  async (invalid) => {
    const context = await createPgTestDatabase('mx_bad_config', {
      configCurrent: false,
    })
    try {
      await context.pool.query(
        "INSERT INTO options (id,name,value) VALUES ('100','membership',$1), ('101','thirdPartyServiceIntegration',$2)",
        [
          {
            dodoApiKey: 'old-billing',
            ...(invalid === 'conflict' ? { apiKey: 'different-billing' } : {}),
            ...(invalid === 'bad-shape'
              ? { apiKey: { malformed: 'private-value' } }
              : {}),
          },
          {
            githubToken:
              invalid === 'bad-ciphertext'
                ? '$${mx}$$v2.invalid.envelope'
                : 'github-private',
          },
        ],
      )
      const before = (
        await context.pool.query('SELECT * FROM options ORDER BY name')
      ).rows
      await expect(
        new AppMigrationsService(context.db, context.pool).run(),
      ).rejects.toThrow(
        invalid === 'conflict'
          ? 'CONFIG_SECRET_CONFLICT'
          : invalid === 'bad-ciphertext'
            ? 'SECRET_UNREADABLE'
            : 'CONFIG_SHAPE_UNSUPPORTED',
      )
      expect(
        (await context.pool.query('SELECT * FROM options ORDER BY name')).rows,
      ).toEqual(before)
      expect(
        (
          await context.pool.query(
            'SELECT id FROM _app_migrations WHERE id=$1',
            [migrationId],
          )
        ).rowCount,
      ).toBe(0)
    } finally {
      await context.close()
    }
  },
)

it('drops fields no schema declares so long-lived installations can migrate', async () => {
  const context = await createPgTestDatabase('mx_stale_config_fields', {
    configCurrent: false,
  })
  try {
    await context.pool.query(
      "INSERT INTO options (id,name,value) VALUES ('100','adminExtra',$1),('101','ai',$2)",
      [
        {
          title: 'retired-title',
          enableAdminProxy: false,
          gaodemapKey: EncryptUtil.encrypt(
            'map-private',
            'adminExtra.gaodemapKey',
          ),
        },
        { enableTranslation: true, summaryMinTextLength: 300 },
      ],
    )
    await new AppMigrationsService(context.db, context.pool).run()
    const stored = Object.fromEntries(
      (await context.pool.query('SELECT name, value FROM options')).rows.map(
        (row) => [row.name, row.value],
      ),
    )
    expect(stored.adminExtra).not.toHaveProperty('title')
    expect(stored.adminExtra.enableAdminProxy).toBe(false)
    expect(
      EncryptUtil.decrypt(
        stored.adminExtra.gaodemapKey,
        'adminExtra.gaodemapKey',
      ),
    ).toBe('map-private')
    expect(stored.ai).not.toHaveProperty('summaryMinTextLength')
    expect(stored.ai.enableTranslation).toBe(true)
    const repository = new OptionsRepository(context.db, new SnowflakeService())
    await expect(repository.findAll()).resolves.toHaveLength(2)
  } finally {
    await context.close()
  }
})

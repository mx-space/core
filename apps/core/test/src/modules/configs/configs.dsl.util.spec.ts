import { Logger } from '@nestjs/common'

import { clearImageCatalogCache } from '~/modules/ai/ai-image/image-catalog'
import {
  attachImageModelOptionsToFormDSL,
  generateFormDSL,
} from '~/modules/configs/configs.dsl.util'

function findImageModelField(dsl: ReturnType<typeof generateFormDSL>) {
  const aiGroup = dsl.groups.find((g) => g.key === 'ai')
  const section = aiGroup?.sections.find(
    (s) => s.key === 'imageGenerationOptions',
  )
  return section?.fields.find((f) => f.key === 'model')
}

describe('generateFormDSL', () => {
  test('excludes the seo.i18n field from the generated form schema', () => {
    const dsl = generateFormDSL()

    const siteGroup = dsl.groups.find((group) => group.key === 'site')
    const seoSection = siteGroup?.sections.find(
      (section) => section.key === 'seo',
    )

    expect(seoSection).toBeTruthy()
    expect(seoSection?.fields.some((field) => field.key === 'i18n')).toBe(false)
  })

  test('exposes provider-neutral membership credential fields', () => {
    const dsl = generateFormDSL()

    const membershipSection = dsl.groups
      .find((group) => group.key === 'membership')
      ?.sections.find((section) => section.key === 'membership')

    expect(
      membershipSection?.fields.map(({ key, title }) => ({ key, title })),
    ).toEqual(
      expect.arrayContaining([
        { key: 'apiKey', title: 'API key' },
        { key: 'webhookSigningKey', title: 'Webhook signing key' },
        { key: 'environment', title: 'Environment' },
      ]),
    )
  })
})

describe('attachImageModelOptionsToFormDSL', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearImageCatalogCache()
  })

  test('does nothing (and never touches the network) when image generation is disabled', async () => {
    const dsl = generateFormDSL()
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await attachImageModelOptionsToFormDSL(dsl, { enable: false })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(findImageModelField(dsl)?.ui.component).toBe('input')
  })

  test('turns the model field into a select populated from the catalog on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'openai/gpt-image-1', name: 'GPT Image 1' },
          { id: 'google/gemini-3-pro-image', name: 'Gemini 3 Pro Image' },
        ],
      }),
    } as Response)
    const dsl = generateFormDSL()

    await attachImageModelOptionsToFormDSL(dsl, {
      enable: true,
      endpoint: 'https://dsl-test-success.example.com/v1',
      apiKey: 'test-api-key',
    })

    const modelField = findImageModelField(dsl)
    expect(modelField?.ui.component).toBe('select')
    expect(modelField?.ui.options).toEqual([
      { label: 'GPT Image 1', value: 'openai/gpt-image-1' },
      { label: 'Gemini 3 Pro Image', value: 'google/gemini-3-pro-image' },
    ])
  })

  test('keeps the model field as free text and warns when the catalog fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    const dsl = generateFormDSL()

    await attachImageModelOptionsToFormDSL(dsl, {
      enable: true,
      endpoint: 'https://dsl-test-failure.example.com/v1',
      apiKey: 'test-api-key',
    })

    expect(findImageModelField(dsl)?.ui.component).toBe('input')
    expect(findImageModelField(dsl)?.ui.options).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})

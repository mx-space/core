import { generateFormDSL } from '~/modules/configs/configs.dsl.util'

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

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
})

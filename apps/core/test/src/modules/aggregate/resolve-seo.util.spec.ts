import { resolveSeo } from '~/modules/aggregate/resolve-seo.util'
import type { SeoConfig } from '~/modules/configs/configs.schema'

const baseSeo: SeoConfig = {
  title: 'Base Title',
  description: 'Base Description',
  icon: 'icon.png',
  iconDark: 'icon-dark.png',
  keywords: ['base1', 'base2'],
  i18n: {
    en: { description: 'EN Description', keywords: ['en1', 'en2'] },
  },
}

describe('resolveSeo', () => {
  test('lang undefined returns base without i18n key', () => {
    const result = resolveSeo(baseSeo, undefined)
    expect(result).toEqual({
      title: 'Base Title',
      description: 'Base Description',
      icon: 'icon.png',
      iconDark: 'icon-dark.png',
      keywords: ['base1', 'base2'],
    })
    expect(result).not.toHaveProperty('i18n')
  })

  test.each(['zh-CN', 'zh-TW'])(
    "lang '%s' returns base without i18n key",
    (lang) => {
      const result = resolveSeo(baseSeo, lang)
      expect(result).toEqual({
        title: 'Base Title',
        description: 'Base Description',
        icon: 'icon.png',
        iconDark: 'icon-dark.png',
        keywords: ['base1', 'base2'],
      })
      expect(result).not.toHaveProperty('i18n')
    },
  )

  test("lang 'en-US' uses the en overlay; overlay fields win, absent ones inherit base", () => {
    const result = resolveSeo(baseSeo, 'en-US')
    expect(result).toEqual({
      title: 'Base Title',
      description: 'EN Description',
      icon: 'icon.png',
      iconDark: 'icon-dark.png',
      keywords: ['en1', 'en2'],
    })
    expect(result).not.toHaveProperty('i18n')
  })

  test('lang without a matching overlay falls back to en overlay', () => {
    const result = resolveSeo(baseSeo, 'ja-JP')
    expect(result.description).toBe('EN Description')
    expect(result.keywords).toEqual(['en1', 'en2'])
    expect(result).not.toHaveProperty('i18n')
  })

  test('lang with empty i18n returns base', () => {
    const seo: SeoConfig = { ...baseSeo, i18n: {} }
    const result = resolveSeo(seo, 'ja-JP')
    expect(result).toEqual({
      title: 'Base Title',
      description: 'Base Description',
      icon: 'icon.png',
      iconDark: 'icon-dark.png',
      keywords: ['base1', 'base2'],
    })
  })

  test('overlay keywords fully replace base keywords without interleaving', () => {
    const result = resolveSeo(baseSeo, 'en-GB')
    expect(result.keywords).toEqual(['en1', 'en2'])
    expect(result.keywords).not.toEqual(
      expect.arrayContaining(['base1', 'base2']),
    )
  })
})

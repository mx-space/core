import { Test } from '@nestjs/testing'
import { ConfigsService } from '~/modules/configs/configs.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

describe('test TextMarcoService', () => {
  let service: TextMacroService

  beforeAll(async () => {
    const moduleRef = Test.createTestingModule({
      providers: [TextMacroService, ConfigsService],
    })
      .overrideProvider(ConfigsService)
      .useValue({
        get() {
          return Promise.resolve({
            macros: true,
          })
        },
      })

    const module = await moduleRef.compile()
    service = await module.resolve(TextMacroService)
  })
  describe('test if condition', () => {
    test('case 1', async () => {
      const res = await service.replaceTextMacro(
        '[[ ? $a > 1 | "yes" | "no" ?  ]]',
        { a: -1 },
      )
      expect(res).toBe('no')
    })

    test('case 2', async () => {
      const res = await service.replaceTextMacro(
        '[[ ? $a > 1 | "yes" | "no" ?  ]]',
        { a: 2 },
      )
      expect(res).toBe('yes')
    })

    test('case 3', async () => {
      const res = await service.replaceTextMacro(
        '[[ ? $a > 1 | "yes" | "no" ?  ]]',
        {},
      )
      expect(res).toBe('no')
    })

    test('case 3', async () => {
      const res = await service.replaceTextMacro(
        '[[ ? $$$ > 1 | "yes" | "no" ?  ]]',
        { $$: 21 },
      )
      expect(res).toBe('yes')
    })
  })

  describe('test function', () => {
    test('case 1', async () => {
      const res = await service.replaceTextMacro(
        "[[ #dayjs($created).format('YYYY-MM-DD') ]]",
        { created: new Date() },
      )
      expect(res).toBe(dayjs().format('YYYY-MM-DD'))
    })

    test('case 2', async () => {
      const date = new Date()
      const res = await service.replaceTextMacro('[[ #$date.toISOString() ]]', {
        date,
      })
      expect(res).toBe(date.toISOString())
    })

    test('case 2', async () => {
      const updated = new Date('2020-01-01')
      const res = await service.replaceTextMacro(
        '更新于 [[ #dayjs($updated).fromNow() ]]',
        { updated },
      )
      expect(res).toBe(`更新于 ${dayjs(updated).fromNow()}`)
    })

    test('case 3', async () => {
      const updated = new Date('2020-01-01')
      const res = await service.replaceTextMacro(
        '更新于 [[ #fromNow($updated) ]]',
        { updated },
      )
      expect(res).toBe(`更新于 ${dayjs(updated).fromNow()}`)
    })

    test('case 4', async () => {
      const created = new Date('2020-01-01')
      const res = await service.replaceTextMacro(
        '创建于 [[ #dayjs($created).format("YYYY-MM-DD") ]]',
        { created },
      )
      expect(res).toBe(`创建于 2020-01-01`)
    })
  })
})

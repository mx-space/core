import { Readable } from 'node:stream'

import type { ArgumentMetadata } from '@nestjs/common'

import { RequestCaseNormalizationPipe } from '~/common/pipes/case-normalization.pipe'

const meta = (type: ArgumentMetadata['type']): ArgumentMetadata => ({
  type,
  metatype: undefined,
  data: undefined,
})

describe('RequestCaseNormalizationPipe', () => {
  const pipe = new RequestCaseNormalizationPipe()

  test('deep-camelizes query payloads', () => {
    expect(
      pipe.transform(
        { sort_by: 'createdAt', filter: { nested_key: 1 } },
        meta('query'),
      ),
    ).toEqual({ sortBy: 'createdAt', filter: { nestedKey: 1 } })
  })

  test('only top-level camelizes body payloads, preserving freeform JSON', () => {
    expect(
      pipe.transform(
        { new_name: 'a', social_ids: { github_user: 'u' } },
        meta('body'),
      ),
    ).toEqual({ newName: 'a', socialIds: { github_user: 'u' } })
  })

  test('deep-camelizes path params', () => {
    expect(pipe.transform({ ref_id: '1' }, meta('param'))).toEqual({
      refId: '1',
    })
  })

  test('returns primitives untouched', () => {
    expect(pipe.transform('snake_value', meta('body'))).toBe('snake_value')
    expect(pipe.transform(42, meta('query'))).toBe(42)
    expect(pipe.transform(null, meta('body'))).toBe(null)
  })

  test('returns Buffers untouched', () => {
    const buf = Buffer.from('hello')
    expect(pipe.transform(buf, meta('body'))).toBe(buf)
  })

  test('returns streams untouched', () => {
    const stream = Readable.from(['payload'])
    expect(pipe.transform(stream, meta('body'))).toBe(stream)
  })

  test('does nothing for custom param types it does not recognize', () => {
    const value = { snake_key: 1 }
    expect(pipe.transform(value, meta('custom'))).toBe(value)
  })
})

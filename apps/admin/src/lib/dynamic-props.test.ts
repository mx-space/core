import { describe, expect, it } from 'vitest'

import {
  applyFieldValue,
  fieldsFromSchema,
  parseJsonObject,
  samplePropsFromSchema,
} from './dynamic-props'

describe('parseJsonObject', () => {
  it('treats blank text as an empty object', () => {
    expect(parseJsonObject('  ')).toEqual({})
  })

  it('accepts only JSON objects', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonObject('[1]')).toBeNull()
    expect(parseJsonObject('null')).toBeNull()
    expect(parseJsonObject('{oops')).toBeNull()
  })
})

describe('samplePropsFromSchema', () => {
  it('collects declared defaults and skips properties without one', () => {
    expect(
      samplePropsFromSchema({
        type: 'object',
        properties: {
          max_count: { type: 'number', default: 3 },
          title: { type: 'string' },
        },
      }),
    ).toEqual({ max_count: 3 })
  })

  it('returns an empty object for a schema without properties', () => {
    expect(samplePropsFromSchema({})).toEqual({})
  })
})

describe('fieldsFromSchema', () => {
  it('maps supported property types to form fields in schema order', () => {
    expect(
      fieldsFromSchema({
        type: 'object',
        required: ['value'],
        properties: {
          label: { type: 'string', title: 'Caption', default: 'Goal' },
          tone: { type: 'string', enum: ['blue', 'green'] },
          value: { type: 'number', description: 'Current amount' },
          steps: { type: 'integer', default: 3 },
          compact: { type: 'boolean' },
        },
      }),
    ).toEqual([
      {
        key: 'label',
        kind: 'string',
        label: 'Caption',
        required: false,
        defaultValue: 'Goal',
      },
      {
        key: 'tone',
        kind: 'enum',
        label: 'tone',
        options: ['blue', 'green'],
        required: false,
      },
      {
        key: 'value',
        kind: 'number',
        label: 'value',
        description: 'Current amount',
        integer: false,
        required: true,
      },
      {
        key: 'steps',
        kind: 'number',
        label: 'steps',
        integer: true,
        required: false,
        defaultValue: 3,
      },
      { key: 'compact', kind: 'boolean', label: 'compact', required: false },
    ])
  })

  it('leaves out properties the form cannot edit', () => {
    expect(
      fieldsFromSchema({
        properties: {
          rows: { type: 'array' },
          meta: { type: 'object' },
          loose: {},
          mixed: { type: ['string', 'null'] },
        },
      }),
    ).toEqual([])
  })

  it('returns no fields for a schema without properties', () => {
    expect(fieldsFromSchema({})).toEqual([])
  })
})

describe('applyFieldValue', () => {
  const numberField = {
    key: 'value',
    kind: 'number',
    label: 'value',
    integer: false,
    required: false,
  } as const

  it('stores a number for a numeric input', () => {
    expect(applyFieldValue({ label: 'a' }, numberField, '9.5')).toEqual({
      label: 'a',
      value: 9.5,
    })
  })

  it('removes the key when the input is cleared', () => {
    expect(applyFieldValue({ value: 3, label: 'a' }, numberField, '')).toEqual({
      label: 'a',
    })
  })

  it('keeps the previous props when a numeric input is not a number', () => {
    const props = { value: 3 }
    expect(applyFieldValue(props, numberField, 'abc')).toBe(props)
  })

  it('truncates integers', () => {
    expect(
      applyFieldValue({}, { ...numberField, integer: true }, '4.7'),
    ).toEqual({ value: 4 })
  })

  it('stores booleans and strings as given', () => {
    expect(
      applyFieldValue(
        {},
        { key: 'compact', kind: 'boolean', label: 'compact', required: false },
        true,
      ),
    ).toEqual({ compact: true })
    expect(
      applyFieldValue(
        {},
        { key: 'label', kind: 'string', label: 'label', required: false },
        '',
      ),
    ).toEqual({ label: '' })
  })
})

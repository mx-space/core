import { expect, it } from 'vitest'

import { serializeAIModelPricing } from './aiModelPricing'

it('converts legacy token and speech prices once while retaining cloud per-million rates', () => {
  expect(
    serializeAIModelPricing({
      unit: 'token',
      prompt: '0.000002',
      completion: '0.000006',
    })[0].rows.map((row) => row.rates),
  ).toEqual([[2], [6]])
  expect(
    serializeAIModelPricing({
      unit: 'character',
      prompt: '0.000015',
      completion: '0',
    })[0].rows[0].rates,
  ).toEqual([15])
  expect(
    serializeAIModelPricing({
      unit: 'token',
      units: [
        {
          name: 'textInput',
          unit: 'millionTokens',
          strategy: 'fixed',
          rate: 0.3,
        },
      ],
    })[0].rows[0].rates,
  ).toEqual([0.3])
})

it('aligns matching tiers while separating different input boundaries', () => {
  const tables = serializeAIModelPricing({
    unit: 'token',
    units: [
      {
        name: 'textInput',
        unit: 'millionTokens',
        strategy: 'tiered',
        tiers: [
          { upTo: 100000, rate: 0.1 },
          { upTo: 'infinity', rate: 0.5 },
        ],
      },
      {
        name: 'textOutput',
        unit: 'millionTokens',
        strategy: 'tiered',
        tiers: [
          { upTo: 100000, rate: 0.5 },
          { upTo: 'infinity', rate: 2.5 },
        ],
      },
      {
        name: 'textInput_cacheRead',
        unit: 'millionTokens',
        strategy: 'tiered',
        tiers: [
          { upTo: 200000, rate: 0.01 },
          { upTo: 'infinity', rate: 0.05 },
        ],
      },
    ],
  })
  expect(tables).toHaveLength(2)
  expect(tables[0].columns).toEqual([100000, 'infinity'])
  expect(tables[0].rows.map((row) => row.rates)).toEqual([
    [0.1, 0.5],
    [0.5, 2.5],
  ])
  expect(tables[1].columns).toEqual([200000, 'infinity'])
})

it('aligns parameter prices by key even when source order differs', () => {
  const tables = serializeAIModelPricing({
    unit: 'token',
    units: [
      {
        name: 'textInput_cacheWrite',
        unit: 'millionTokens',
        strategy: 'lookup',
        lookup: { pricingParams: ['ttl'], prices: { '5m': 1.25, '1h': 2 } },
      },
      {
        name: 'textInput_cacheRead',
        unit: 'millionTokens',
        strategy: 'lookup',
        lookup: { pricingParams: ['ttl'], prices: { '1h': 0.2, '5m': 0.125 } },
      },
    ],
  })
  expect(tables).toHaveLength(1)
  const column = tables[0].columns.indexOf('5m')
  expect(
    tables[0].rows.find((row) => row.name === 'textInput_cacheWrite')?.rates[
      column
    ],
  ).toBe(1.25)
  expect(
    tables[0].rows.find((row) => row.name === 'textInput_cacheRead')?.rates[
      column
    ],
  ).toBe(0.125)
})

it('keeps image and request prices under their own units', () => {
  expect(
    serializeAIModelPricing({
      unit: 'token',
      prompt: '0.000002',
      image: '0.04',
      request: '0.01',
    }).map((table) => [table.unit, table.rows[0].rates[0]]),
  ).toEqual([
    ['millionTokens', 2],
    ['image', 0.04],
    ['request', 0.01],
  ])
})

it('omits missing or invalid rates and preserves an explicitly reported zero', () => {
  expect(serializeAIModelPricing(undefined)).toEqual([])
  expect(serializeAIModelPricing({ unit: 'token', units: [] })).toEqual([])
  expect(
    serializeAIModelPricing({
      unit: 'token',
      units: [
        {
          name: 'textInput',
          strategy: 'fixed',
          unit: 'millionTokens',
          rate: NaN,
        },
      ],
    }),
  ).toEqual([])
  expect(
    serializeAIModelPricing({ unit: 'token', prompt: '0' })[0].rows[0].rates,
  ).toEqual([0])
})

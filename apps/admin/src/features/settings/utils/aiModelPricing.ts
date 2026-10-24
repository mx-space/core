import type { AIModelPricing } from '../types/settings'

export interface SerializedPricingTable {
  unit: 'millionTokens' | 'millionCharacters' | 'image' | 'second' | 'request'
  strategy: 'fixed' | 'tiered' | 'lookup'
  columns: Array<number | string>
  params?: string[]
  rows: Array<{ name: string; rates: Array<number | null> }>
}

export function serializeAIModelPricing(
  pricing: AIModelPricing | undefined,
): SerializedPricingTable[] {
  if (!pricing) return []
  const tables = new Map<string, SerializedPricingTable>()
  function add(
    unit: SerializedPricingTable['unit'],
    strategy: SerializedPricingTable['strategy'],
    columns: SerializedPricingTable['columns'],
    name: string,
    values: number[],
    params?: string[],
  ) {
    const rates = values.map((rate) =>
      Number.isFinite(rate) && rate >= 0 ? rate : null,
    )
    if (rates.every((rate) => rate === null)) return
    const key = JSON.stringify([unit, strategy, columns, params])
    let table = tables.get(key)
    if (!table) {
      table = { unit, strategy, columns, params, rows: [] }
      tables.set(key, table)
    }
    table.rows.push({ name, rates })
  }
  if (pricing.units) {
    for (const unit of pricing.units) {
      if (unit.strategy === 'fixed')
        add(unit.unit, unit.strategy, [''], unit.name, [unit.rate])
      else if (unit.strategy === 'tiered')
        add(
          unit.unit,
          unit.strategy,
          unit.tiers.map((tier) => tier.upTo),
          unit.name,
          unit.tiers.map((tier) => tier.rate),
        )
      else {
        const keys = Object.keys(unit.lookup.prices).sort()
        add(
          unit.unit,
          unit.strategy,
          keys,
          unit.name,
          keys.map((key) => unit.lookup.prices[key]),
          unit.lookup.pricingParams,
        )
      }
    }
  } else {
    const prompt = parsePrice(pricing.prompt)
    const completion = parsePrice(pricing.completion)
    if (pricing.unit === 'character') {
      const rate = prompt || completion || (prompt ?? completion)
      if (rate !== undefined)
        add('millionCharacters', 'fixed', [''], 'textInput', [rate * 1_000_000])
    } else {
      if (prompt !== undefined)
        add('millionTokens', 'fixed', [''], 'textInput', [prompt * 1_000_000])
      if (completion !== undefined)
        add('millionTokens', 'fixed', [''], 'textOutput', [
          completion * 1_000_000,
        ])
    }
    for (const unit of ['image', 'request'] as const) {
      const rate = parsePrice(pricing[unit])
      if (rate !== undefined)
        add(unit, 'fixed', [''], unit === 'image' ? 'imageOutput' : 'request', [
          rate,
        ])
    }
  }
  const order = [
    'textInput',
    'textOutput',
    'textInput_cacheRead',
    'textInput_cacheWrite',
  ]
  for (const table of tables.values())
    table.rows.sort(
      (a, b) =>
        (!order.includes(a.name) ? order.length : order.indexOf(a.name)) -
        (!order.includes(b.name) ? order.length : order.indexOf(b.name)),
    )
  return [...tables.values()]
}

function parsePrice(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

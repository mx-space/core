import type {
  LinkCardData,
  LinkCardPlugin,
  UrlMatchResult,
} from '@haklex/rich-renderer-linkcard'
import type { ReactNode } from 'react'
import type { EnrichmentAttribute, EnrichmentResult } from '../../types'

const cache = new Map<string, EnrichmentResult>()
const inflight = new Map<string, Promise<EnrichmentResult>>()

function formatAttr(a: EnrichmentAttribute): string {
  const v = a.value
  switch (a.format) {
    case 'rating':
      return typeof v === 'number' ? `★ ${v.toFixed(1)}` : `★ ${v}`
    case 'percent':
      return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : `${v}`
    case 'date':
      return typeof v === 'string'
        ? new Date(v).toLocaleDateString('zh-CN')
        : String(v)
    case 'duration':
      if (typeof v === 'number') {
        const m = Math.floor(v / 60)
        const s = Math.floor(v % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
      }
      return String(v)
    case 'number':
      return typeof v === 'number' ? v.toLocaleString() : String(v)
    default:
      return String(v)
  }
}

function renderDesc(e: EnrichmentResult): ReactNode {
  const pieces: ReactNode[] = []

  if (e.description) {
    pieces.push(
      <span key="desc" style={{ display: 'block' }}>
        {e.description}
      </span>,
    )
  }

  const attrs = (e.attributes ?? []).slice(0, 5)
  if (attrs.length > 0) {
    pieces.push(
      <span
        key="attrs"
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: '0 12px',
          marginTop: e.description ? 4 : 0,
          fontVariantNumeric: 'tabular-nums',
          opacity: 0.85,
        }}
      >
        {attrs.map((a) => (
          <span key={a.key}>
            {a.label ? `${a.label} ` : ''}
            {formatAttr(a)}
          </span>
        ))}
      </span>,
    )
  }

  return pieces.length === 0 ? undefined : <>{pieces}</>
}

export interface CreateEnrichmentPluginOptions {
  /**
   * Override priority. Defaults to 1000 to take precedence over all built-in
   * plugins (githubPrPlugin sits at 95).
   */
  priority?: number
}

export function createEnrichmentPlugin(
  options: CreateEnrichmentPluginOptions = {},
): LinkCardPlugin {
  return {
    name: 'enrichment',
    displayName: 'Admin Enrichment',
    priority: options.priority ?? 1000,
    shape: 'compact',
    provider: 'enrichment',

    matchUrl(url: URL): UrlMatchResult | null {
      const full = url.toString()
      return { id: full, fullUrl: full }
    },

    isValidId(id: string): boolean {
      return id.length > 0
    },

    async fetch(id, _meta, context): Promise<LinkCardData> {
      const adapter = context?.adapters?.enrichment
      if (!adapter) {
        throw new Error('[enrichment] adapter missing in LinkCardFetchContext')
      }

      const cached = cache.get(id)
      if (cached) return mapToCardData(cached)

      let pending = inflight.get(id)
      if (!pending) {
        pending = adapter
          .request<EnrichmentResult | null>(id)
          .then((res) => {
            if (!res) throw new Error('[enrichment] empty result')
            cache.set(id, res)
            return res
          })
          .finally(() => {
            inflight.delete(id)
          }) as Promise<EnrichmentResult>
        inflight.set(id, pending)
      }

      const e = await pending
      return mapToCardData(e)
    },
  }
}

function mapToCardData(e: EnrichmentResult): LinkCardData {
  return {
    title: e.title,
    desc: renderDesc(e),
    image: e.thumbnailImage?.url,
    color: e.color,
  }
}

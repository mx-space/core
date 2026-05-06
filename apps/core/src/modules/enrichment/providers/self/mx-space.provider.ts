import { Injectable } from '@nestjs/common'

import { DatabaseService } from '~/processors/database/database.service'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class MxSpaceProvider implements EnrichmentProvider {
  readonly name = 'mx-space'
  readonly displayName = 'Mix Space'
  readonly category = ENRICHMENT_CATEGORIES.SELF
  readonly priority = 5
  readonly defaultTtl = 300

  constructor(private readonly databaseService: DatabaseService) {}

  matchUrl(url: URL): UrlMatchResult | null {
    const path = url.pathname
    const postMatch = path.match(/^\/posts\/([^/]+)/)
    if (postMatch) return { id: `post:${postMatch[1]}`, fullUrl: url.href, subtype: 'post' }
    const noteMatch = path.match(/^\/notes\/(\d+)/)
    if (noteMatch) return { id: `note:${noteMatch[1]}`, fullUrl: url.href, subtype: 'note' }
    return null
  }

  isValidId(id: string): boolean { return /^(post|note):/.test(id) }

  async fetch(id: string): Promise<EnrichmentResult> {
    const [type, ...rest] = id.split(':')
    const slugOrNid = rest.join(':')

    if (type === 'post') {
      const collection = await this.databaseService.findGlobalByIds([slugOrNid])
      const item = collection?.posts?.[0]
      if (!item) throw new Error(`Post not found: ${slugOrNid}`)

      return {
        title: item.title || slugOrNid,
        description: (item.text || '').slice(0, 300) || undefined,
        url: id, category: this.category, subtype: 'post',
        fetchedAt: '',
        attributes: [{ key: 'type', value: 'post', label: 'Type', format: 'text' }],
      }
    }

    if (type === 'note') {
      const nid = parseInt(slugOrNid, 10)
      const collection = await this.databaseService.findGlobalByIds([String(nid)])
      const item = collection?.notes?.[0]
      if (!item) throw new Error(`Note not found: ${nid}`)

      return {
        title: `Note #${item.nid || nid}`,
        description: (item.text || '').slice(0, 300) || undefined,
        url: id, category: this.category, subtype: 'note',
        fetchedAt: '',
        attributes: [{ key: 'type', value: 'note', label: 'Type', format: 'text' }],
      }
    }

    throw new Error(`Unknown self content type: ${type}`)
  }
}

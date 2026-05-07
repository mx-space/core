import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { isDev } from '~/global/env.global'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

const POST_PATH_RE = /^\/posts\/([^/]+)\/([^/]+)$/
const NOTE_DATE_PATH_RE = /^\/notes\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/([^/]+)$/
const NOTE_NID_PATH_RE = /^\/notes\/(\d+)$/

@Injectable()
export class MxSpaceProvider implements EnrichmentProvider, OnModuleInit {
  readonly name = 'mx-space'
  readonly displayName = 'Mix Space'
  readonly category = ENRICHMENT_CATEGORIES.SELF
  readonly priority = 5
  readonly defaultTtl = 300

  private readonly logger = new Logger(MxSpaceProvider.name)
  /**
   * Cached configured site hostname (e.g. `innei.in`). `matchUrl` is
   * synchronous, but `configsService.get` is async — refresh into this slot
   * on init and on `ConfigChanged` so the path-matching pass can read it
   * without awaiting.
   */
  private siteHost: string | null = null

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configsService: ConfigsService,
  ) {}

  async onModuleInit() {
    await this.refreshSiteHost()
  }

  @OnEvent(EventBusEvents.ConfigChanged)
  async onConfigChanged() {
    await this.refreshSiteHost()
  }

  private async refreshSiteHost() {
    try {
      const url = await this.configsService.get('url')
      const webUrl = url?.webUrl
      this.siteHost = webUrl ? new URL(webUrl).hostname : null
    } catch (err) {
      this.logger.warn(
        `Failed to read configured webUrl for self provider host check: ${
          (err as Error)?.message ?? err
        }`,
      )
      this.siteHost = null
    }
  }

  matchUrl(url: URL): UrlMatchResult | null {
    // In production we only treat URLs whose hostname matches the configured
    // `webUrl` as self content — otherwise any third-party `/posts/cat/slug`
    // path would erroneously route here. In development the local backend's
    // `webUrl` is `localhost:2333`, but we want to verify the link card with
    // production URLs (`innei.in/...`), so skip the host check entirely.
    if (!isDev && (!this.siteHost || url.hostname !== this.siteHost))
      return null

    const path = url.pathname

    const postMatch = POST_PATH_RE.exec(path)
    if (postMatch) {
      const [, category, slug] = postMatch
      return {
        id: `post:${category}/${slug}`,
        fullUrl: url.href,
        subtype: 'post',
      }
    }

    const noteDateMatch = NOTE_DATE_PATH_RE.exec(path)
    if (noteDateMatch) {
      const [, year, month, day, slug] = noteDateMatch
      return {
        id: `note-date:${year}/${month}/${day}/${slug}`,
        fullUrl: url.href,
        subtype: 'note',
      }
    }

    const noteNidMatch = NOTE_NID_PATH_RE.exec(path)
    if (noteNidMatch) {
      return {
        id: `note:${noteNidMatch[1]}`,
        fullUrl: url.href,
        subtype: 'note',
      }
    }

    return null
  }

  isValidId(id: string): boolean {
    return /^(?:post|note|note-date):/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const sepIdx = id.indexOf(':')
    const type = id.slice(0, sepIdx)
    const rest = id.slice(sepIdx + 1)

    if (type === 'post') {
      const slugIdx = rest.indexOf('/')
      const slug = slugIdx === -1 ? rest : rest.slice(slugIdx + 1)
      const post = await this.databaseService.findPostBySlug(slug)
      if (!post) throw new Error(`Post not found: ${rest}`)
      return {
        title: post.title || rest,
        description: (post.text || '').slice(0, 300) || undefined,
        url: id,
        category: this.category,
        subtype: 'post',
        fetchedAt: '',
        attributes: [
          { key: 'type', value: 'post', label: 'Type', format: 'text' },
        ],
      }
    }

    if (type === 'note') {
      const nid = Number.parseInt(rest, 10)
      if (!Number.isFinite(nid)) throw new Error(`Invalid note nid: ${rest}`)
      const note = await this.databaseService.findNoteByNid(nid)
      if (!note) throw new Error(`Note not found: ${nid}`)
      return {
        title: note.title || `Note #${note.nid || nid}`,
        description: (note.text || '').slice(0, 300) || undefined,
        url: id,
        category: this.category,
        subtype: 'note',
        fetchedAt: '',
        attributes: [
          { key: 'type', value: 'note', label: 'Type', format: 'text' },
        ],
      }
    }

    if (type === 'note-date') {
      const [year, month, day, slug] = rest.split('/')
      const note = await this.databaseService.findNoteByDateAndSlug(
        Number(year),
        Number(month),
        Number(day),
        slug,
      )
      if (!note) throw new Error(`Note not found: ${rest}`)
      return {
        title: note.title || `Note ${rest}`,
        description: (note.text || '').slice(0, 300) || undefined,
        url: id,
        category: this.category,
        subtype: 'note',
        fetchedAt: '',
        attributes: [
          { key: 'type', value: 'note', label: 'Type', format: 'text' },
        ],
      }
    }

    throw new Error(`Unknown self content type: ${type}`)
  }
}

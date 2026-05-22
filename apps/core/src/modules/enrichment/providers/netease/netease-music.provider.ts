import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import type { NeteaseSongDetailApiResponse } from '../api-response.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class NeteaseMusicProvider implements EnrichmentProvider {
  readonly name = 'netease-music'
  readonly displayName = 'NetEase Cloud Music'
  readonly category = ENRICHMENT_CATEGORIES.MUSIC
  readonly priority = 10
  readonly defaultTtl = 86400
  readonly featureGateConfigKey = 'neteaseMusic'

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'music.163.com') return null
    const id = url.searchParams.get('id')
    if (!id) return null
    return { id, fullUrl: url.href, subtype: 'song' }
  }

  isValidId(id: string): boolean {
    return /^\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const res = await fetch(
      `https://music.163.com/api/song/detail/?id=${id}&ids=%5B${id}%5D`,
    )
    if (!res.ok) throw new Error(`Netease API ${res.status}`)
    const data: NeteaseSongDetailApiResponse = await res.json()
    const song = data.songs?.[0]
    if (!song) throw new Error(`Song not found: ${id}`)
    const attrs: NonNullable<EnrichmentResult['attributes']> = []
    if (song.artists?.length)
      attrs.push({
        key: 'artist',
        value: song.artists.map((a: any) => a.name).join(', '),
        label: 'Artist',
        format: 'text',
      })
    if (song.album?.name)
      attrs.push({
        key: 'album',
        value: song.album.name,
        label: 'Album',
        format: 'text',
      })

    return {
      title: song.name || id,
      description: song.artists?.map((a: any) => a.name).join(', '),
      thumbnailImage: song.album?.picUrl
        ? { url: song.album.picUrl, alt: song.album.name }
        : undefined,
      url: `https://music.163.com/#/song?id=${id}`,
      category: this.category,
      subtype: 'song',
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

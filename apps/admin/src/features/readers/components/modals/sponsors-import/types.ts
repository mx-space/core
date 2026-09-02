import type { SponsorReaderMatch } from '~/api/readers'

export interface SponsorEntry {
  key: string
  title: string
  subtitle: string | null
  avatarUrl: string | null
  badge: 'active' | 'past' | null
  months: number | null
  reader: SponsorReaderMatch | null
}

export interface SponsorSourceState {
  entries: SponsorEntry[]
  loading: boolean
  error: string | null
  emptyText: string
}

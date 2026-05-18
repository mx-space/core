import type { View } from '../../services/Renderer/view'
import { bold, dim, dot, fail, humanUntil } from '../ui'

export interface WhoamiData {
  readonly user: {
    readonly name?: string
    readonly email?: string
    readonly role?: string
  } | null
  readonly api_url: string
  readonly profile: string | null
  readonly expires_at?: number | null
}

const renderIdentLine = (user: WhoamiData['user'], color: boolean): string => {
  if (user?.name) {
    return `${bold(user.name, color)}${
      user.email ? ` ${dim(`· ${user.email}`, color)}` : ''
    }`
  }
  if (user?.email) return bold(user.email, color)
  return dim('(no user data)', color)
}

export const whoamiView: View<WhoamiData> = {
  kind: 'whoami',
  modes: new Set(['readable', 'llm']),
  readable: (data, { color }) => {
    const head = dot('signed in', color)
    const ident = renderIdentLine(data.user, color)
    const meta: string[] = []
    if (data.user?.role) meta.push(`role: ${data.user.role}`)
    meta.push(`api: ${data.api_url}`)
    if (data.expires_at) {
      meta.push(`session expires in ${humanUntil(data.expires_at)}`)
    }
    return `${head}\n\n  ${ident}\n  ${dim(meta.join('  ·  '), color)}`
  },
}

export interface StatusData {
  readonly authenticated: boolean
  readonly profile: string | null
  readonly expires_at?: number
  readonly expiring_soon?: boolean
  readonly has_refresh?: boolean
  readonly user?: {
    readonly name?: string
    readonly email?: string
    readonly role?: string
  } | null
}

export const statusView: View<StatusData> = {
  kind: 'status',
  modes: new Set(['readable', 'llm']),
  readable: (data, { color }) => {
    if (!data.authenticated) {
      return `${fail('not authenticated', color)}\n  ${dim('run `mxs auth login`', color)}`
    }
    const head = dot('signed in', color)
    const ident = renderIdentLine(data.user ?? null, color)
    const meta: string[] = []
    if (data.profile) meta.push(`profile: ${data.profile}`)
    if (data.user?.role) meta.push(`role: ${data.user.role}`)
    if (data.expires_at !== undefined) {
      const expires = `expires in ${humanUntil(data.expires_at)}`
      meta.push(data.expiring_soon ? `${expires} (expiring soon)` : expires)
    }
    return `${head}\n\n  ${ident}\n  ${dim(meta.join('  ·  '), color)}`
  },
}

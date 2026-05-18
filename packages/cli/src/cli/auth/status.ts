import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { isExpiringSoon } from '../../services/Auth'
import { Config } from '../../services/Config'
import { Renderer } from '../../services/Renderer'
import { statusView } from './view'

export const status = Command.make('status', {}, () =>
  Effect.gen(function* () {
    const config = yield* Config
    const renderer = yield* Renderer

    const envProfile = process.env.MXS_PROFILE?.trim() || null
    const profileName = envProfile || (yield* config.readCurrent) || null
    const cred = profileName
      ? yield* config.readProfileCredentials(profileName)
      : null

    if (!cred) {
      yield* renderer.emit(statusView, {
        authenticated: false,
        profile: profileName,
      })
      return
    }

    const expiringSoon = isExpiringSoon(cred)
    yield* renderer.emit(statusView, {
      authenticated: true,
      expires_at: cred.expires_at,
      expiring_soon: expiringSoon,
      has_refresh: Boolean(cred.refresh_token),
      user: cred.user ?? null,
      profile: profileName,
    })
  }),
)

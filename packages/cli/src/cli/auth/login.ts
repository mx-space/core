import { Command, Options } from '@effect/cli'
import { Effect, FiberRef, Option } from 'effect'
import open from 'open'

import { Generic } from '../../domain/errors'
import { currentProfileFlag } from '../../domain/runtime-flags'
import { Auth, toCredentials } from '../../services/Auth'
import {
  Config,
  type ConfigShape,
  DEFAULT_CLIENT_ID,
  parseApiUrl,
} from '../../services/Config'
import { Editor } from '../../services/Editor'
import { Profile } from '../../services/Profile'
import { Renderer } from '../../services/Renderer'
import { arrow, bold, dim, humanDuration, indent, ok, roundedBox } from '../ui'

const production = Options.boolean('production', {
  negationNames: ['no-production'],
}).pipe(Options.optional)

const DEFAULT_PROFILE = 'default'

export const login = Command.make('login', { production }, ({ production }) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const profile = yield* Profile
    const config = yield* Config
    const editor = yield* Editor
    const renderer = yield* Renderer
    const opts = yield* renderer.options

    // 1. Resolve api-url + target profile from current config; prompt when
    //    no URL is available on a fresh install.
    //
    //    The `--profile` global flag is pre-parsed and propagated via a
    //    FiberRef; forward it as an override so `auth login --profile foo`
    //    targets `foo` even when the active-profile pointer is missing or
    //    points at a profile whose directory has been deleted manually.
    const flagProfile = yield* FiberRef.get(currentProfileFlag)
    const resolved = yield* profile
      .resolve(flagProfile ? { profile: flagProfile } : {})
      .pipe(
        Effect.catchTags({
          Generic: (e) => {
            // ConfigMissingApiUrl is collapsed into Generic by Profile.resolve;
            // detect it via the preserved `cause` and prompt instead of failing.
            const cause = (e as { cause?: { _tag?: string } }).cause
            return cause?._tag === 'ConfigMissingApiUrl'
              ? Effect.succeed(null)
              : Effect.fail(e)
          },
          // The active-profile pointer (or the resolved profile name) refers
          // to a directory that does not exist. `auth login` is the command
          // that *creates* a profile, so treat this as a fresh-install path
          // rather than a hard error.
          ProfileNotFound: () => Effect.succeed(null),
        }),
      )

    let apiUrl: string
    let targetProfile: string | null
    if (resolved) {
      apiUrl = resolved.apiUrl
      targetProfile = resolved.profileName
    } else {
      const answer = yield* editor.prompt(
        'Enter your mx-space API URL (e.g. https://blog.example.com):',
        { placeholder: 'https://blog.example.com' },
      )
      const trimmed = answer.trim()
      if (!trimmed) {
        return yield* Effect.fail(
          new Generic({ message: 'API URL is required' }),
        )
      }
      const parsed = yield* parseApiUrl(trimmed).pipe(
        Effect.mapError((e) => new Generic({ message: e.message, cause: e })),
      )
      apiUrl = parsed.baseUrl
      // Prefer the explicit `--profile` flag over a stale `current` pointer.
      // Falling back to `readCurrent` preserves the historical behaviour on
      // fresh installs (no flag, no pointer → step 5 lands on DEFAULT_PROFILE).
      targetProfile = flagProfile?.trim() || (yield* config.readCurrent)
    }

    yield* renderer.emitInfoBlock(
      ({ color }) => `${arrow(`probing ${apiUrl}…`, color)}`,
    )

    // 2. Probe the auth endpoint.
    const probeResult = yield* auth.probe(apiUrl).pipe(
      Effect.mapError(
        (e) =>
          new Generic({
            message: e.message ?? 'auth probe failed',
            cause: e,
          }),
      ),
    )

    // 3. Request the device code.
    const code = yield* auth.requestDeviceCode(
      probeResult.authBase,
      DEFAULT_CLIENT_ID,
    )

    // Boxed device-code banner: verification URL on top, code in a rounded
    // box for legibility, expiry hint underneath.
    yield* renderer.emitInfoBlock(({ color }) => {
      const ttl = humanDuration(code.expires_in)
      const lines = [
        `  ${dim('API base:', color)} ${probeResult.apiBase}`,
        '',
        `  Visit ${bold(code.verification_uri, color)} and enter:`,
        '',
        indent(roundedBox([`  ${bold(code.user_code, color)}  `]), 6),
        '',
        `  ${dim(`Expires in ${ttl}.`, color)}`,
      ]
      return lines.join('\n')
    })

    if (opts.json) {
      yield* renderer.emitSuccess({
        verification_uri: code.verification_uri,
        verification_uri_complete: code.verification_uri_complete,
        user_code: code.user_code,
        expires_in: code.expires_in,
        interval: code.interval,
      })
    } else if (!opts.quiet && code.verification_uri_complete) {
      yield* Effect.sync(() => {
        void open(code.verification_uri_complete!).catch(() => undefined)
      })
    }

    // 4. Poll for token.
    const token = yield* auth.pollDeviceToken(
      probeResult.authBase,
      DEFAULT_CLIENT_ID,
      code.device_code,
      {
        intervalSec: code.interval,
        expiresInSec: code.expires_in,
        onTick: (state) => {
          if (state === 'slow_down' && !opts.quiet && !opts.json) {
            process.stderr.write('slow_down — increasing interval\n')
          }
        },
      },
    )
    const cred = toCredentials(token)

    // 5. Determine target profile per legacy precedence:
    //    1. resolved profileName (which itself honours --profile / MXS_PROFILE / current)
    //    2. fresh install → 'default'
    const target = targetProfile?.trim() || DEFAULT_PROFILE

    const existing = yield* config
      .readProfileConfig(target)
      .pipe(Effect.catchAll(() => Effect.succeed({} as ConfigShape)))

    const productionFlag = Option.getOrElse(production, () => undefined)
    yield* config.writeProfileConfig(target, {
      ...existing,
      api_url: apiUrl,
      api_version: probeResult.apiVersion,
      ...(productionFlag !== undefined
        ? { production: productionFlag }
        : existing.production !== undefined
          ? { production: existing.production }
          : {}),
    })
    yield* config.writeProfileCredentials(target, cred)
    yield* config.writeCurrent(target)

    // Some servers (notably local-dev) omit `user` from the device-token
    // response. Probe `/get-session` to backfill so `whoami` / `status` have
    // something to display. Best-effort: failures fall back to the original
    // creds and are surfaced only via the missing-user readable output.
    const enriched = yield* auth
      .enrichUser(target, probeResult.authBase, cred)
      .pipe(Effect.catchAll(() => Effect.succeed(cred)))

    // 6. Mark production via the Profile service when explicitly requested
    //    (idempotent with the write above — Profile.mark enforces the
    //    profile-exists invariant and is the documented surface).
    if (productionFlag === true) {
      yield* profile
        .mark(target, { production: true })
        .pipe(
          Effect.catchAll((e) =>
            Effect.fail(
              new Generic({ message: e.message ?? String(e), cause: e }),
            ),
          ),
        )
    }

    yield* renderer.emitView(
      {
        user: enriched.user ?? null,
        expires_at: enriched.expires_at,
        profile: target,
      },
      ({ color }) => {
        const head = ok(`logged in to '${target}'`, color)
        const user = enriched.user
        if (!user || (!user.name && !user.email)) return head
        const name = user.name ?? user.email ?? ''
        const email = user.name && user.email ? ` (${user.email})` : ''
        const role = (user as { role?: string }).role
        const meta = role ? `${name}${email} · ${role}` : `${name}${email}`
        return `${head}\n  ${dim(meta, color)}`
      },
    )
  }),
)

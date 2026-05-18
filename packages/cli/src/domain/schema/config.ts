import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Profile config schema — matches `~/.config/mxs/profiles/<name>/config.json`.
//
// `production` is optional and only present when explicitly marked. Legacy
// fields (`api_base`, `auth_base`, `client_id`) are tolerated on read by
// stripping them before decoding — see `stripLegacyConfigFields` in
// `services/Config.ts`.
// ---------------------------------------------------------------------------

export const ProfileConfigSchema = Schema.Struct({
  api_url: Schema.optional(Schema.String),
  api_version: Schema.optional(Schema.Number),
  production: Schema.optional(Schema.Boolean),
})

export type ProfileConfig = Schema.Schema.Type<typeof ProfileConfigSchema>

// Top-level `~/.config/mxs/config.json` is identical in shape today (it only
// exists in the legacy single-profile layout). We re-export the same schema
// under a distinct name to keep call sites self-documenting.
export const LegacyConfigSchema = ProfileConfigSchema
export type LegacyConfig = ProfileConfig

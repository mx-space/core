import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Profile credentials schema — matches
// `~/.config/mxs/profiles/<name>/credentials.json`.
// ---------------------------------------------------------------------------

const ProfileUserSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
})

export const ProfileCredentialsSchema = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_at: Schema.Number,
  user: Schema.optional(ProfileUserSchema),
})

export type ProfileCredentials = Schema.Schema.Type<
  typeof ProfileCredentialsSchema
>

// ---------------------------------------------------------------------------
// Profile name — `^[a-z0-9_-]{1,32}$`, excluding the reserved word `current`.
// ---------------------------------------------------------------------------

export const ProfileNameSchema = Schema.String.pipe(
  Schema.pattern(/^[\d_a-z-]{1,32}$/, {
    message: () =>
      'profile name must match ^[a-z0-9_-]{1,32}$ and is case-sensitive',
  }),
  Schema.filter((s) => (s === 'current' ? "'current' is reserved" : true)),
)

export type ProfileName = Schema.Schema.Type<typeof ProfileNameSchema>

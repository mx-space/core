# mxs CLI — Environment Profiles

**Status**: Draft
**Date**: 2026-05-18
**Owner**: Innei

## Problem

The `@mx-space/cli` package (`mxs`) currently stores a single API URL plus a
single credentials slot per OS user. Most operators run the CLI against
multiple environments — typically a development instance during feature work
and a production blog instance for real writes — and switching between them
is unsafe:

- `~/.config/mxs/config.json` holds a single `api_url`; `~/.config/mxs/credentials.json` holds a single `access_token`.
- `MXS_API_URL` redirects requests, but the same `access_token` from `credentials.json` is still attached. A prod token can be sent to a dev backend, or a dev token to prod.
- `mxs auth login` writes to the single credentials file. Logging in against dev overwrites prod credentials, forcing a re-login when switching back.
- There is no signal — visual or programmatic — telling the operator which environment the next command will touch.

Concretely: running `mxs post update my-slug --file …` while the on-disk
config still points at prod silently mutates production. Running `mxs auth
login` to test a dev change silently destroys the prod refresh token.

## Goals

- Bind credentials to API URLs so a single CLI invocation cannot mix tokens across environments.
- Provide an obvious switching mechanism for routine dev/prod toggling.
- Refuse silent writes against production: production-tier profiles must be selected explicitly per invocation (flag or env), not merely inherited from a sticky pointer.
- Keep one-off overrides (`--api-url`, `MXS_API_URL`, `--token`) working for CI and ad-hoc use.
- Migrate existing single-profile users without data loss.

## Non-Goals

- Per-profile API keys. API keys remain env/flag-only (`--api-key`, `MXS_API_KEY`).
- Cross-machine profile sync. Profiles stay local to `~/.config/mxs/`.
- Encrypting credentials at rest (out of scope; `chmod 600` continues as today).
- Multiple credential slots per profile (e.g. session + API key). One credentials file per profile.

## Design

### 1. Storage Layout

```
~/.config/mxs/
├── current                       # text, single line: active profile name
└── profiles/
    └── <name>/
        ├── config.json           # api_url, api_base, auth_base, api_version, client_id, production
        └── credentials.json      # access_token, refresh_token?, expires_at, user?   (chmod 600)
```

- `current` is a plain text file containing exactly one profile name plus a trailing newline. Absence of the file means no active profile.
- `profiles/<name>/config.json` is the existing `ConfigShape` plus one new boolean field `production` (default `false`).
- `profiles/<name>/credentials.json` is the existing `CredentialsShape` unchanged.
- Profile names: lowercase ASCII, digits, dash, underscore (`^[a-z0-9_-]+$`), 1–32 chars. Validated at creation. Names `current` and empty are reserved.
- Per-profile directories are created with mode `0700`; `credentials.json` with mode `0600`; `config.json` with mode `0644`.

### 2. Resolution Chain

The CLI resolves runtime config in this order, highest precedence first:

**Profile name selection**
1. `--profile <name>` flag
2. `MXS_PROFILE` env var
3. `~/.config/mxs/current` file
4. None — error (`profile.none_active`) unless invoked command is `profile`, `auth login --profile <name>`, or `--help`.

**API URL**
1. `--api-url` flag
2. `MXS_API_URL` env var
3. Selected profile's `config.api_url`

**Access token**
1. `--token` flag
2. `MXS_TOKEN` env var
3. Selected profile's `credentials.access_token`

**API key**
1. `--api-key` flag
2. `MXS_API_KEY` env var
3. *(no per-profile storage)*

When `--api-url` or `MXS_API_URL` is set, the value is normalized through `normalizeApiUrl` and the derived `api_base` / `auth_base` are recomputed on the fly (matching today's behavior). In this URL-overridden mode the CLI also **decouples credentials from the active profile**: the token must come from `--token` / `MXS_TOKEN` / `--api-key` / `MXS_API_KEY`. The active profile's `credentials.json` is **not** read. If no override token is supplied, the request fires unauthenticated. This rule is what makes URL-override safe to bypass the production write gate (see §4) — a prod token cannot leak to a custom URL by accident.

### 3. CLI Surface

New `mxs profile` subcommand group:

| Command | Behavior |
| --- | --- |
| `mxs profile ls` | Print one row per profile: name, api_url, production flag, current marker. Default JSON-aware output. |
| `mxs profile show [<name>]` | Show resolved config for a profile (or current). Includes token expiry, user, production flag. Never prints token. |
| `mxs profile use <name>` | Write `<name>` to `~/.config/mxs/current`. Errors if profile dir missing. |
| `mxs profile mark <name> [--production \| --no-production]` | Toggle `production` flag in that profile's `config.json`. |
| `mxs profile rm <name>` | Delete profile dir. Confirmation prompt in TTY; `--force` in non-TTY. Refuses removal of the current profile unless `--force`. |

Auth integration:

- `mxs auth login [--profile <name>] [--production]`:
  - If `--profile` given, login writes to `profiles/<name>/`. Create dir if absent.
  - If `--profile` omitted and a `current` exists, login refreshes the active profile.
  - If `--profile` omitted and no `current` exists (fresh install), login creates and selects profile `default`.
  - `--production` sets the `production` flag on the target profile after the login succeeds.
- `mxs auth logout [--profile <name>]`: clears credentials for the target profile. Defaults to active.
- `mxs auth whoami` / `mxs auth status`: scope to the active profile per §2.

### 4. Production Write Gate

A command is gated when **all** of the following are true:

1. The resolved profile has `production: true`.
2. The profile name was selected by the `current` file alone (i.e. **not** via `--profile` or `MXS_PROFILE`).
3. The CLI is **not** running with `--api-url` or `MXS_API_URL` overriding the URL.
4. The command issues an HTTP method other than `GET` (i.e. `POST`, `PUT`, `PATCH`, `DELETE`).

When all four hold, the CLI refuses before issuing the request and emits:

```json
{ "ok": false, "error": "profile.write_requires_explicit",
  "profile": "prod", "api_url": "https://blog.example.com",
  "hint": "active profile 'prod' is production; retry with --profile prod or MXS_PROFILE=prod" }
```

Exit code: **4** (new code, distinct from existing auth / config errors).

Bypass paths:
- `--profile prod mxs post publish foo` — explicit flag
- `MXS_PROFILE=prod mxs post publish foo` — env (shell aliases / direnv style)
- `mxs --api-url https://… post publish foo` — explicit URL (URL bypasses profile entirely)

`mxs profile use prod` followed by a write is **not** sufficient — the gate measures explicitness per invocation, not session intent.

`mxs auth login` and `mxs auth logout` are exempt: they don't perform content writes and need to be runnable to recover from a broken token.

### 5. Active-Profile Banner

When a command resolves to a `production: true` profile (gated or not), the
CLI emits a single-line banner to stderr before executing:

```
mxs: profile=prod (production) → https://blog.example.com
```

- Suppressed by `--quiet` / `-q`.
- Emitted on stderr only; never pollutes stdout.
- Not emitted for non-production profiles (no noise on dev).

### 6. Migration from Legacy Layout

On any CLI invocation, before resolving config, check for the legacy paths:

- `~/.config/mxs/config.json` (file, not dir)
- `~/.config/mxs/credentials.json` (file)

If either exists **and** `~/.config/mxs/profiles/` does not exist, perform a one-shot migration:

1. `mkdir -p ~/.config/mxs/profiles/default/` with mode `0700`.
2. Move `config.json` and `credentials.json` (whichever exist) into the new dir. Move, not copy, to avoid divergent state.
3. If running in a TTY and the legacy `config.json` had an `api_url`, prompt: `Is "<api_url>" a production environment? [y/N]`.
   - Yes → write `"production": true` into the migrated `config.json` (insert the field if missing).
   - No / empty → leave the field absent (treated as `false`).
   - Non-TTY → skip prompt, leave the field absent.
4. Write `default\n` into `~/.config/mxs/current`.
5. Emit to stderr: `mxs: migrated single-profile config to profile 'default'.`
6. Continue with the original command.

Migration runs at most once. Subsequent invocations see `profiles/` and skip the check. If `profiles/` exists but legacy files also exist (incomplete prior run), the legacy files are deleted with a warning.

### 7. Backward Compatibility

- `MXS_API_URL`, `MXS_TOKEN`, `MXS_API_KEY` continue to function and are treated as explicit overrides (no production gate).
- `--api-url`, `--token`, `--api-key`, `--json`, `--quiet`, `--verbose`, `--dry-run` flags retain their semantics.
- The new `--profile` flag is global, parsed alongside existing flags.
- Existing structured error codes are preserved; one new code is added: `profile.write_requires_explicit` (exit code 4). `profile.none_active` is added for the no-active case (exit code 4 also).
- The published `0.1.0` keeps working until a user upgrades; the migration step on first run of the new version converts their setup atomically.

### 8. Module Boundaries

Affected source files:

- `packages/cli/src/core/config-store.ts` — extend with profile-aware path helpers (`getProfileDir`, `getProfileConfigPath`, `getProfileCredentialsPath`, `getCurrentProfile`, `setCurrentProfile`), legacy migration entry point, `production` flag in `ConfigShape`.
- `packages/cli/src/core/profile.ts` (new) — profile listing, CRUD, name validation, active-profile resolution.
- `packages/cli/src/core/gate.ts` (new) — production write gate decision function (pure; takes resolved context, returns allow/refuse).
- `packages/cli/src/bin/mxs.ts` — wire `--profile` global flag; integrate gate check before every HTTP write.
- `packages/cli/src/core/api-client.ts` — call gate before issuing non-GET requests; emit banner for production profile.
- `packages/cli/src/commands/profile/{ls,show,use,mark,rm}.ts` (new) — subcommand implementations.
- `packages/cli/src/commands/auth/login.ts` — accept `--profile` and `--production`; write to the targeted profile dir.
- `packages/cli/src/commands/auth/logout.ts` — accept `--profile`; clear targeted profile.
- `packages/cli/src/core/onboarding.ts` — onboarding flows write into the active or newly-created profile, not the legacy paths.
- `packages/cli/README.md` — document profile commands, env vars, migration note.

### 9. Testing

- **Unit — resolution matrix**: tabulate `(flag, env, current, profile-config)` combinations and assert returned `ResolvedConfig` for URL, token, and selected profile name.
- **Unit — legacy migration**: pre-stage legacy files in a temp HOME, run migration, assert new layout, file modes, and TTY-prompt branch via mocked `text()`.
- **Unit — production gate**: parametric test of the four conditions × bypass paths; assert structured error + exit code 4.
- **Unit — profile name validation**: accept/reject cases.
- **Unit — banner**: emitted to stderr only, suppressed by `--quiet`, formatted as specified.
- **Integration — profile CRUD**: round-trip `profile use → ls → mark --production → show → rm` in a temp config dir.
- **Integration — write gate**: stub a mock backend; verify a write against `production` active profile without explicit `--profile` exits with code 4 and no HTTP request fires.

All tests run against a temp `XDG_CONFIG_HOME` to avoid touching the operator's real config.

## Open Questions

- **Banner verbosity**: should non-production profiles also get a (quieter) banner? Decision deferred — start with prod-only, revisit if confusion persists.
- **`mxs profile clone <src> <dst>`**: convenience for copying URL but forcing re-login. Out of scope for v1; add if usage warrants.
- **Cross-profile diff**: `mxs profile show` could optionally accept two profiles for side-by-side comparison. Defer.

## Rollout

1. Land the implementation in a single PR — feature is internally cohesive and partial rollouts add risk (a half-migrated config dir is worse than today).
2. Tag `@mx-space/cli@0.2.0` (minor bump; existing flag/env contracts preserved, new behavior is additive plus a one-shot migration).
3. README + ROADMAP updates ship in the same PR.
4. Update `session-to-skill-and-blog` and `mxs-cli-ai-author` skills to reference `--profile` patterns once shipped.

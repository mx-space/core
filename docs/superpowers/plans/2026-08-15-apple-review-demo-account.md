# Apple Sign-in App Review demo 账号 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner toggle a system `reader` demo account on the Apple OAuth settings page, copy its credentials for App Store review, sign in via existing `/sign-in/email` even when owner password login is disabled, and wipe that account’s content nightly.

**Architecture:** A reserved identity (`app-review@users.invalid`) plus `oauth.public.apple.reviewDemoEnabled` / `oauth.secrets.apple.reviewDemoPassword`. `ReviewDemoService.sync()` provisions or bans on `ConfigChanged`. Email sign-in is gated by a pure function inside Better Auth’s `hooks.before`. `GET /auth/review-demo` (owner) reveals the password because oauth secrets are stripped from `getOption`. A midnight cron soft-deletes that reader’s comments, deletes poll votes, and restores the default profile.

**Tech Stack:** NestJS, Better Auth, Drizzle/Postgres, Vitest, admin React (Vite).

## Global Constraints

- Work in `/Users/innei/git/innei-repo/mx-core` only. Do not change Yohaku.
- Zero comments/JSDoc except a documented workaround or non-obvious invariant.
- **No git commits** — user rule overrides the skill template; every task ends with a verification checkpoint instead.
- Lint/typecheck only touched files.
- Core tests: `pnpm -C apps/core exec vitest run <file>`
- Admin tests: `pnpm -C apps/admin exec vitest run <file>`
- No new `readers` columns, no password-rotate button, no mobile UI.
- Demo email/handle/name are constants, never derived from site URL.
- `oauth.secrets.apple.reviewDemoPassword` stays in secrets (encrypted). Never put the password in `oauth.public`.

## File map

| File | Responsibility |
|---|---|
| `apps/core/src/modules/auth/review-demo.constants.ts` | Fixed identity + oauth key names + `isReviewDemoEnabled` |
| `apps/core/src/modules/auth/email-sign-in-gate.ts` | Pure deny/allow for `/sign-in/email` |
| `apps/core/src/modules/auth/review-demo.service.ts` | `sync`, `getCredentials`, `getEmailSignInGate`, `resetDaily` |
| `apps/core/src/modules/auth/auth.implement.ts` | Call gate in `hooks.before` |
| `apps/core/src/modules/auth/auth.middleware.ts` | Pass gate into `CreateAuth`; bypass `/auth/review-demo` |
| `apps/core/src/modules/auth/auth.controller.ts` | `GET review-demo` |
| `apps/core/src/modules/auth/auth.service.ts` | Block transferring owner to the demo reader |
| `apps/core/src/modules/auth/auth.module.ts` | Provide/export `ReviewDemoService`; import Comment + Poll |
| `apps/core/src/modules/poll/poll-vote.repository.ts` | `deleteByFingerprint` |
| `apps/core/src/modules/poll/poll.module.ts` | Export `PollVoteRepository` |
| `apps/core/src/modules/cron-task/*` | Register midnight `ResetReviewDemo` |
| `apps/admin/src/features/settings/utils/oauth.ts` | Ignore `reviewDemoEnabled` in `configured` |
| `apps/admin/src/features/settings/components/account/OauthProviderSection.tsx` | Apple-only switch + credential reveal |
| `apps/admin/src/api/auth.ts` + i18n + query keys | Client for `GET /auth/review-demo` |

---

### Task 1: Identity constants and email sign-in gate

**Files:**
- Create: `apps/core/src/modules/auth/review-demo.constants.ts`
- Create: `apps/core/src/modules/auth/email-sign-in-gate.ts`
- Test: `apps/core/test/src/modules/auth/email-sign-in-gate.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const REVIEW_DEMO_EMAIL = 'app-review@users.invalid'
  export const REVIEW_DEMO_HANDLE = 'app-review'
  export const REVIEW_DEMO_NAME = 'App Reviewer'
  export const REVIEW_DEMO_BAN_REASON = 'app-review-demo'
  export const REVIEW_DEMO_PUBLIC_ENABLED_KEY = 'reviewDemoEnabled'
  export const REVIEW_DEMO_SECRET_PASSWORD_KEY = 'reviewDemoPassword'

  export function isReviewDemoEnabled(oauth: {
    public?: Partial<Record<string, Record<string, string>>>
  }): boolean

  export function isReviewDemoIdentity(input: {
    email?: string | null
    handle?: string | null
    username?: string | null
  }): boolean

  export type EmailSignInGate = {
    disablePasswordLogin: boolean
    reviewDemoEnabled: boolean
    reviewDemoBanned: boolean
  }

  export function denyEmailSignIn(email: string, gate: EmailSignInGate): boolean
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import {
  denyEmailSignIn,
  type EmailSignInGate,
} from '~/modules/auth/email-sign-in-gate'
import {
  isReviewDemoEnabled,
  isReviewDemoIdentity,
  REVIEW_DEMO_EMAIL,
} from '~/modules/auth/review-demo.constants'

const open: EmailSignInGate = {
  disablePasswordLogin: false,
  reviewDemoEnabled: true,
  reviewDemoBanned: false,
}

describe('denyEmailSignIn', () => {
  it('allows the demo email when the toggle is on and the reader is not banned', () => {
    expect(denyEmailSignIn(REVIEW_DEMO_EMAIL, open)).toBe(false)
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(false)
  })

  it('denies the demo email when the toggle is off or the reader is banned', () => {
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        reviewDemoEnabled: false,
      }),
    ).toBe(true)
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        reviewDemoBanned: true,
      }),
    ).toBe(true)
  })

  it('denies every other email when password login is disabled', () => {
    expect(
      denyEmailSignIn('owner@example.com', {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(true)
  })

  it('allows every other email when password login is enabled', () => {
    expect(denyEmailSignIn('owner@example.com', open)).toBe(false)
  })
})

describe('isReviewDemoEnabled / isReviewDemoIdentity', () => {
  it('reads only apple.reviewDemoEnabled === "true"', () => {
    expect(
      isReviewDemoEnabled({
        public: { apple: { reviewDemoEnabled: 'true' } },
      }),
    ).toBe(true)
    expect(
      isReviewDemoEnabled({
        public: { apple: { reviewDemoEnabled: '' } },
      }),
    ).toBe(false)
  })

  it('matches the reserved email and handle', () => {
    expect(
      isReviewDemoIdentity({
        email: REVIEW_DEMO_EMAIL,
        handle: 'app-review',
      }),
    ).toBe(true)
    expect(
      isReviewDemoIdentity({
        email: REVIEW_DEMO_EMAIL,
        handle: 'someone-else',
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/email-sign-in-gate.spec.ts`

Expected: FAIL — modules not found.

- [ ] **Step 3: Write the two modules**

`review-demo.constants.ts`:

```ts
export const REVIEW_DEMO_EMAIL = 'app-review@users.invalid'
export const REVIEW_DEMO_HANDLE = 'app-review'
export const REVIEW_DEMO_NAME = 'App Reviewer'
export const REVIEW_DEMO_BAN_REASON = 'app-review-demo'
export const REVIEW_DEMO_PUBLIC_ENABLED_KEY = 'reviewDemoEnabled'
export const REVIEW_DEMO_SECRET_PASSWORD_KEY = 'reviewDemoPassword'

export function isReviewDemoEnabled(oauth: {
  public?: Partial<Record<string, Record<string, string>>>
}): boolean {
  return oauth.public?.apple?.[REVIEW_DEMO_PUBLIC_ENABLED_KEY] === 'true'
}

export function isReviewDemoIdentity(input: {
  email?: string | null
  handle?: string | null
  username?: string | null
}): boolean {
  return (
    input.email === REVIEW_DEMO_EMAIL &&
    (input.handle === REVIEW_DEMO_HANDLE ||
      input.username === REVIEW_DEMO_HANDLE)
  )
}
```

`email-sign-in-gate.ts`:

```ts
import { REVIEW_DEMO_EMAIL } from './review-demo.constants'

export type EmailSignInGate = {
  disablePasswordLogin: boolean
  reviewDemoEnabled: boolean
  reviewDemoBanned: boolean
}

export function denyEmailSignIn(
  email: string,
  gate: EmailSignInGate,
): boolean {
  const isDemo = email.trim().toLowerCase() === REVIEW_DEMO_EMAIL
  if (isDemo) {
    return !gate.reviewDemoEnabled || gate.reviewDemoBanned
  }
  return gate.disablePasswordLogin
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/email-sign-in-gate.spec.ts`

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

Gate truth table matches spec §三. No Nest imports.

---

### Task 2: Ignore reviewDemoEnabled in Apple `configured`

**Files:**
- Modify: `apps/admin/src/features/settings/utils/oauth.ts`
- Test: `apps/admin/src/features/settings/utils/oauth.test.ts`

**Interfaces:**
- Consumes: public key `reviewDemoEnabled`
- Produces: `flattenOauthOptions` `configured` is false when the only public field is `reviewDemoEnabled: "true"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { flattenOauthOptions } from './oauth'

describe('flattenOauthOptions', () => {
  it('does not treat reviewDemoEnabled as Apple being configured', () => {
    const flat = flattenOauthOptions({
      providers: [{ enabled: true, type: 'apple' }],
      public: { apple: { reviewDemoEnabled: 'true' } },
    })
    expect(flat.apple.configured).toBe(false)
    expect(flat.apple.enabled).toBe(true)
    expect(flat.apple.public.reviewDemoEnabled).toBe('true')
  })

  it('still marks Apple configured when a real public field is set', () => {
    const flat = flattenOauthOptions({
      public: {
        apple: { clientId: 'dev.example.web', reviewDemoEnabled: 'true' },
      },
    })
    expect(flat.apple.configured).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/admin exec vitest run src/features/settings/utils/oauth.test.ts`

Expected: FAIL — first assertion `configured` is true.

- [ ] **Step 3: Change `flattenOauthOptions`**

```ts
const oauthConfiguredIgnoredKeys = new Set(['reviewDemoEnabled'])

export function flattenOauthOptions(
  data: OauthOptions | undefined,
): Record<OauthProviderType, FlatOauthProvider> {
  const providerMap = new Map(
    (data?.providers ?? []).map((provider) => [provider.type, provider]),
  )

  return Object.fromEntries(
    oauthProviders.map((provider) => {
      const publicFields = { ...data?.public?.[provider.type] }
      return [
        provider.type,
        {
          configured: Object.entries(publicFields).some(
            ([key, value]) =>
              !oauthConfiguredIgnoredKeys.has(key) && Boolean(value),
          ),
          enabled: providerMap.get(provider.type)?.enabled ?? false,
          public: publicFields,
          type: provider.type,
        },
      ]
    }),
  ) as Record<OauthProviderType, FlatOauthProvider>
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -C apps/admin exec vitest run src/features/settings/utils/oauth.test.ts`

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

Apple “configured” (secret placeholder / validate enablement) is unchanged for real credentials.

---

### Task 3: Bypass Better Auth for `GET /auth/review-demo`

**Files:**
- Modify: `apps/core/src/modules/auth/auth.middleware.ts` (`shouldBypassBetterAuth`)
- Modify: `apps/core/test/src/modules/auth/auth.middleware.spec.ts`

**Interfaces:**
- Produces: `shouldBypassBetterAuth('/auth/review-demo') === true` (and versioned `/api/v2/auth/review-demo/`)

- [ ] **Step 1: Extend the existing bypass test**

In `shouldBypassBetterAuth()` examples, add:

```ts
expect(shouldBypassBetterAuth('/auth/review-demo')).toBe(true)
expect(shouldBypassBetterAuth('/api/v2/auth/review-demo/')).toBe(true)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/auth.middleware.spec.ts`

Expected: FAIL on the new assertions.

- [ ] **Step 3: Update the regex**

```ts
export function shouldBypassBetterAuth(originalUrl: string) {
  const pathname = originalUrl.split('?')[0]?.replace(/\/+$/, '') || ''
  return /\/auth\/(?:token|session|providers|review-demo)$/.test(pathname)
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/auth.middleware.spec.ts`

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

`/auth/sign-in/email` is still handled by Better Auth (`false`).

---

### Task 4: `ReviewDemoService` provision / ban / credentials

**Files:**
- Create: `apps/core/src/modules/auth/review-demo.service.ts`
- Test: `apps/core/test/src/modules/auth/review-demo.service.spec.ts`

**Interfaces:**
- Consumes: `isReviewDemoEnabled`, `isReviewDemoIdentity`, constants from Task 1; `ConfigsService.get` / `patchAndValid`; `ReaderRepository`; `AuthRepository`; `SnowflakeService`; `hashPassword` from `better-auth/crypto`
- Produces:
  ```ts
  class ReviewDemoService {
    sync(): Promise<void>
    getEmailSignInGate(): Promise<EmailSignInGate>
    getCredentials(): Promise<
      | { enabled: false }
      | { enabled: true; email: string; password: string }
      | { enabled: true; email: string; error: 'provision_failed' }
    >
    generatePassword(): string
  }
  ```
  Password: `randomBytes(18).toString('base64url')`. Re-entrancy: if `sync()` is already running, return immediately (patching secrets re-emits `ConfigChanged`).

- [ ] **Step 1: Write the failing service tests** (mock all collaborators)

Cover:

1. Toggle on, no reader → `readerRepository.create` with `role: 'reader'`, `email: REVIEW_DEMO_EMAIL`, `handle/username: REVIEW_DEMO_HANDLE`, `name/displayUsername: REVIEW_DEMO_NAME`, `image` omitted/null, `emailVerified: true`; `authRepository.createAccount` with `providerId: 'credential'`; `patchAndValid('oauth', { secrets: { apple: { reviewDemoPassword } } })` once.
2. Toggle on, reader exists, not banned, password already in secrets → no `create`, no `patchAndValid`, no password change.
3. Toggle on, reader banned → `unsetBanned` + `update` restoring `name`, `displayUsername`, `image: null`. Password unchanged.
4. Toggle off, reader exists → `setBanned` with `banReason: 'app-review-demo'` + `deleteSessionsForUser`.
5. Toggle on, email occupied by a non-demo identity → no overwrite; `getCredentials()` after `sync` returns `{ enabled: true, email, error: 'provision_failed' }`.
6. Toggle on, secrets missing password, credential account exists → generate, `updateAccountPassword`, `patchAndValid`.
7. `getEmailSignInGate` maps `authSecurity.disablePasswordLogin` and `bannedAt`.

Use `vi.fn()` mocks. Do not hit Postgres.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/review-demo.service.spec.ts`

Expected: FAIL — service not found.

- [ ] **Step 3: Implement `ReviewDemoService`**

Constructor:

```ts
constructor(
  private readonly configsService: ConfigsService,
  private readonly readerRepository: ReaderRepository,
  private readonly authRepository: AuthRepository,
  private readonly snowflakeService: SnowflakeService,
) {}
```

`sync()` outline:

```
if (this.syncing) return
this.syncing = true
try {
  const oauth = await this.configsService.get('oauth')
  const enabled = isReviewDemoEnabled(oauth)
  const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
  if (!enabled) {
    if (reader && isReviewDemoIdentity(reader)) {
      await this.readerRepository.setBanned(reader.id, {
        bannedAt: new Date(),
        banReason: REVIEW_DEMO_BAN_REASON,
      })
      await this.readerRepository.deleteSessionsForUser(reader.id)
    }
    return
  }
  if (reader && !isReviewDemoIdentity(reader)) {
    this.logger.error('review demo email is occupied by a non-demo reader')
    return
  }
  let password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
  if (!password) {
    password = this.generatePassword()
    await this.configsService.patchAndValid('oauth', {
      secrets: { apple: { [REVIEW_DEMO_SECRET_PASSWORD_KEY]: password } },
    })
  }
  if (!reader) {
    const id = this.snowflakeService.nextId()
    await this.readerRepository.create({ ...defaults, id, role: 'reader' })
    await this.authRepository.createAccount({
      id: this.snowflakeService.nextId(),
      providerAccountId: id,
      providerId: 'credential',
      userId: id,
      password: await hashPassword(password),
    })
    return
  }
  if (reader.bannedAt) {
    await this.readerRepository.unsetBanned(reader.id)
    await this.readerRepository.update(reader.id, {
      name: REVIEW_DEMO_NAME,
      displayUsername: REVIEW_DEMO_NAME,
      image: null,
    })
  }
  const accounts = await this.authRepository.findAccountsForUser(reader.id)
  const credential = accounts.find((a) => a.providerId === 'credential')
  if (!credential) {
    await this.authRepository.createAccount({ ... })
  } else if (!oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]) {
    // already written above when password was missing
  }
} finally {
  this.syncing = false
}
```

When secrets were missing **and** a credential row already exists, call `updateAccountPassword(credential.id, await hashPassword(password))` after generating.

`getCredentials()`:

```
await this.sync()
const oauth = await this.configsService.get('oauth')
if (!isReviewDemoEnabled(oauth)) return { enabled: false }
const password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
if (!password || !reader || !isReviewDemoIdentity(reader) || reader.bannedAt) {
  return { enabled: true, email: REVIEW_DEMO_EMAIL, error: 'provision_failed' }
}
return { enabled: true, email: REVIEW_DEMO_EMAIL, password }
```

Calling `sync()` here closes the race between admin Save and the first credential fetch.

- [ ] **Step 4: Run tests**

Run: `pnpm -C apps/core exec vitest run test/src/modules/auth/review-demo.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

Disable path never deletes the reader row. Re-enable does not call `generatePassword` when secrets already have a password.

---

### Task 5: Wire Nest — hook, controller, owner transfer

**Files:**
- Modify: `apps/core/src/modules/auth/auth.implement.ts`
- Modify: `apps/core/src/modules/auth/auth.middleware.ts`
- Modify: `apps/core/src/modules/auth/auth.controller.ts`
- Modify: `apps/core/src/modules/auth/auth.service.ts` (`transferOwnerRole`)
- Modify: `apps/core/src/modules/auth/auth.module.ts`
- Test: `apps/core/test/src/modules/auth/auth.service.spec.ts` (existing `createService()` helper)

**Interfaces:**
- Consumes: `denyEmailSignIn`, `ReviewDemoService.getEmailSignInGate`, `ReviewDemoService.getCredentials`, `isReviewDemoIdentity`
- Produces: `CreateAuth(..., getEmailSignInGate?: () => Promise<EmailSignInGate>)`; `GET /auth/review-demo` `@Auth()`; transfer owner rejected for the demo reader

- [ ] **Step 1: Write failing transfer-owner test**

Append to `apps/core/test/src/modules/auth/auth.service.spec.ts`:

```ts
import {
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_HANDLE,
} from '~/modules/auth/review-demo.constants'

it('rejects transferring owner to the app review demo reader', async () => {
  const { readerRepository, service } = createService()
  readerRepository.findById.mockResolvedValue({
    id: 'demo-1',
    email: REVIEW_DEMO_EMAIL,
    handle: REVIEW_DEMO_HANDLE,
    username: REVIEW_DEMO_HANDLE,
  })

  await expect(service.transferOwnerRole('demo-1')).rejects.toThrow(
    AppException,
  )
  expect(readerRepository.setRole).not.toHaveBeenCalled()
})
```

Add `setRole: vi.fn()` (and `setOwnersExceptToReader: vi.fn()`) to the `readerRepository` mock in `createService()`.

- [ ] **Step 2: Run the new test — expect FAIL** (no identity check yet)

- [ ] **Step 3: Implement wiring**

1. `CreateAuth` 5th argument `getEmailSignInGate?: () => Promise<EmailSignInGate>`. In `hooks.before`, **after** the existing `role` check:

```ts
if (ctx.path === '/sign-in/email') {
  const email =
    typeof ctx.body?.email === 'string' ? ctx.body.email : ''
  const gate = getEmailSignInGate
    ? await getEmailSignInGate()
    : {
        disablePasswordLogin: false,
        reviewDemoEnabled: false,
        reviewDemoBanned: false,
      }
  if (denyEmailSignIn(email, gate)) {
    throw new APIError('UNAUTHORIZED', {
      message: 'Invalid email or password',
    })
  }
}
```

2. `AuthMiddleware.ensureAuthHandlerFresh` — inject `ReviewDemoService`, pass `() => this.reviewDemoService.getEmailSignInGate()` into `CreateAuth`.

3. `AuthController`:

```ts
@Get('review-demo')
@Auth()
@HttpCache({ disable: true })
getReviewDemo() {
  return this.reviewDemoService.getCredentials()
}
```

Inject `ReviewDemoService` in the controller constructor.

4. `transferOwnerRole` immediately after `findById`:

```ts
if (isReviewDemoIdentity(target)) {
  throw createAppException(AppErrorCode.INVALID_PARAMETER, {
    message: 'cannot transfer owner to the app review demo account',
  })
}
```

5. `AuthModule.forRoot`:
   - `providers` add `ReviewDemoService`, `AuthMiddleware` (if not already injectable — middleware used in `configure` is instantiated by Nest if listed **or** via constructor injection of other providers; listing `ReviewDemoService` is enough if `AuthMiddleware` is created by `consumer.apply(AuthMiddleware)` which requires it in module providers). **Add `AuthMiddleware` and `ReviewDemoService` to `providers`.** Export `ReviewDemoService`.
   - `imports`: leave Comment/Poll for Task 6. Task 5 must compile: `ReviewDemoService` in Task 4 does not yet inject Comment/Poll.

- [ ] **Step 4: Run tests**

```
pnpm -C apps/core exec vitest run test/src/modules/auth/email-sign-in-gate.spec.ts test/src/modules/auth/auth.middleware.spec.ts test/src/modules/auth/review-demo.service.spec.ts test/src/modules/auth/auth.implement.spec.ts
```

Plus the transfer-owner spec.

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

`pnpm -C apps/core exec tsc --noEmit` if cheap enough; otherwise eslint the touched auth files.

`GET /auth/review-demo` is not swallowed by Better Auth (Task 3 regex).

---

### Task 6: Nightly reset

**Files:**
- Modify: `apps/core/src/modules/poll/poll-vote.repository.ts` — add `deleteByFingerprint`
- Modify: `apps/core/src/modules/poll/poll.module.ts` — `exports: [PollService, PollVoteRepository]`
- Modify: `apps/core/src/modules/auth/review-demo.service.ts` — `resetDaily`
- Modify: `apps/core/src/modules/auth/auth.module.ts` — `imports: [forwardRef(() => CommentModule), PollModule]`
- Modify: `apps/core/src/modules/cron-task/cron-task.types.ts`
- Modify: `apps/core/src/modules/cron-task/cron-task.scheduler.ts`
- Modify: `apps/core/src/modules/cron-task/cron-business.service.ts`
- Test: `apps/core/test/src/modules/auth/review-demo.service.spec.ts` (extend) and `apps/core/test/src/modules/poll/poll-vote.repository.spec.ts` if a unit test without DB is impractical, test `deleteByFingerprint` via a small mocked-db suite **or** extend review-demo tests by mocking `pollVoteRepository.deleteByFingerprint` and `commentService.softDeleteComment`.

**Interfaces:**
- Consumes: `CommentService.softDeleteComment`, `CommentRepository.findByFilter({ readerId, isDeleted: false })`, `PollVoteRepository.deleteByFingerprint`, `ReaderRepository.update`
- Produces:
  ```ts
  PollVoteRepository.deleteByFingerprint(fingerprint: string): Promise<number>
  ReviewDemoService.resetDaily(): Promise<{
    comments: number
    pollVotes: number
  } | { skipped: true }>
  CronTaskType.ResetReviewDemo = 'cron:reset-review-demo'
  ```
  Scheduler: `@CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'resetReviewDemo' })` dispatching `CronTaskType.ResetReviewDemo`. `CronTaskMetas` `methodName: 'resetReviewDemo'` must exist on `CronBusinessService`.

- [ ] **Step 1: Write failing tests**

Service tests:

- Toggle off → `resetDaily` does not call `softDeleteComment`.
- Toggle on, demo reader present, two comment ids from `findByFilter` → `softDeleteComment` called twice; `deleteByFingerprint('r:' + id)` once; `readerRepository.update` with default name/image; sessions **not** deleted.

Poll repository implementation can be tested later with e2e; for this task mock it on the service.

- [ ] **Step 2: Run tests — expect FAIL** (`resetDaily` missing)

- [ ] **Step 3: Implement**

`deleteByFingerprint`:

```ts
async deleteByFingerprint(fingerprint: string): Promise<number> {
  const deleted = await this.db
    .delete(pollVotes)
    .where(eq(pollVotes.voterFingerprint, fingerprint))
    .returning({ id: pollVotes.id })
  return deleted.length
}
```

(`poll_vote_options` already `ON DELETE CASCADE`.)

`resetDaily`:

```
const oauth = await this.configsService.get('oauth')
if (!isReviewDemoEnabled(oauth)) return { skipped: true }
const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
if (!reader || !isReviewDemoIdentity(reader)) return { skipped: true }
const comments = await this.commentRepository.findByFilter({
  readerId: reader.id,
  isDeleted: false,
})
for (const comment of comments) {
  await this.commentService.softDeleteComment(String(comment.id))
}
const pollVotes = await this.pollVoteRepository.deleteByFingerprint(
  `r:${reader.id}`,
)
await this.readerRepository.update(reader.id, {
  name: REVIEW_DEMO_NAME,
  displayUsername: REVIEW_DEMO_NAME,
  image: null,
})
return { comments: comments.length, pollVotes }
```

Inject `CommentService`, `CommentRepository`, `PollVoteRepository` with `forwardRef` on `CommentService` if Nest complains.

`CronBusinessService.resetReviewDemo()`:

```ts
async resetReviewDemo() {
  return this.reviewDemoService.resetDaily()
}
```

Add `ReviewDemoService` to `CronBusinessService` constructor. `CronTaskModule` does not need to import `AuthModule` (it is `@Global`).

Register type + meta + scheduler method mirroring `resetIPAccess`.

- [ ] **Step 4: Run tests**

```
pnpm -C apps/core exec vitest run test/src/modules/auth/review-demo.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Verification checkpoint**

`CronTaskMetas` key count matches `CronTaskType` keys (the scheduler iterates `Object.keys(CronTaskMetas)`). `resetDaily` does not call `deleteSessionsForUser`.

---

### Task 7: Admin Apple switch and credential reveal

**Files:**
- Modify: `apps/admin/src/api/auth.ts` — `getReviewDemo`
- Modify: `apps/admin/src/query/keys.ts` — `settings.reviewDemo`
- Modify: `apps/admin/src/features/settings/types/settings.ts` — `OauthProviderPayload` unchanged (public already `Record<string, string>`)
- Modify: `apps/admin/src/features/settings/components/account/OauthProviderSection.tsx`
- Modify: `apps/admin/src/features/settings/components/account/OauthSection.tsx` — invalidate `reviewDemo` query on save success
- Modify: `apps/admin/src/i18n/resources/en-US.ts`
- Modify: `apps/admin/src/i18n/resources/zh-CN.ts`

**Interfaces:**
- Consumes: `GET /auth/review-demo` JSON from Task 5
- Produces: Apple section Switch; when enabled, show email/password with copy; helper text about App Store Connect + daily reset

i18n keys (add to **both** locales; `TranslationKey` is `keyof typeof zhCN`):

| key | en-US | zh-CN |
|---|---|---|
| `settings.oauth.reviewDemo.switch` | App Review demo account | App 审核 Demo 账号 |
| `settings.oauth.reviewDemo.helper` | Creates a reader account for App Store review. Comments and profile reset daily. Sign-in uses the email form even if password login is disabled. | 创建供 App Store 审核使用的读者账号。评论与资料每日重置。即使关闭密码登录，仍可用邮箱表单登录此账号。 |
| `settings.oauth.reviewDemo.email` | Review email | 审核邮箱 |
| `settings.oauth.reviewDemo.password` | Review password | 审核密码 |
| `settings.oauth.reviewDemo.copyEmailAria` | Copy review email | 复制审核邮箱 |
| `settings.oauth.reviewDemo.copyPasswordAria` | Copy review password | 复制审核密码 |
| `settings.oauth.reviewDemo.provisionFailed` | Demo account is enabled but not ready. Save again or check logs. | Demo 账号已开启但尚未就绪，请再保存一次或查看日志。 |

- [ ] **Step 1: Add API + keys**

```ts
export type ReviewDemoResponse =
  | { enabled: false }
  | { enabled: true; email: string; password: string }
  | { enabled: true; email: string; error: 'provision_failed' }

export function getReviewDemo() {
  return getJson<ReviewDemoResponse>('/auth/review-demo')
}
```

```ts
reviewDemo: () => ['settings', 'account', 'review-demo'] as const,
```

- [ ] **Step 2: Apple-only UI in `OauthProviderSection`**

Local state `reviewDemoEnabled`, initialized from `props.data.public.reviewDemoEnabled === 'true'`, reset in the existing `useEffect`.

`save()` already writes `payload.public[field.key]`. After the field loop:

```ts
if (props.type === 'apple') {
  payload.public.reviewDemoEnabled = reviewDemoEnabled ? 'true' : ''
}
```

Below the field grid, only when `props.type === 'apple'`:

- `Switch` bound to `reviewDemoEnabled` with `t('settings.oauth.reviewDemo.switch')`
- helper paragraph
- `useQuery` with `queryKey: adminQueryKeys.settings.reviewDemo()`, `queryFn: getReviewDemo`, `enabled: props.type === 'apple' && reviewDemoEnabled && props.data.public.reviewDemoEnabled === 'true'` (so we fetch after a successful save has persisted the flag; also enable when local switch is on **and** last saved public flag is true)

When query data `enabled: true` and `'password' in data`, show two rows (email, password) with the same copy-button pattern as the callback URL.

When `error === 'provision_failed'`, show the error string, no fake password.

- [ ] **Step 3: Invalidate on save**

In `OauthSection` `onSuccess`, also:

```ts
await queryClient.invalidateQueries({
  queryKey: adminQueryKeys.settings.reviewDemo(),
})
```

- [ ] **Step 4: Typecheck admin i18n**

Run: `pnpm -C apps/admin exec tsc --noEmit`

Expected: PASS (`TranslationKey` includes the new keys because they exist in zh-CN).

- [ ] **Step 5: Verification checkpoint**

GitHub/Google sections have no extra switch. Saving Apple with the demo switch off sends `reviewDemoEnabled: ''`. Password is never written into `payload.public` or `payload.secrets` from the client.

---

## Manual check (after all tasks)

1. Admin → Account → Apple: fill Apple creds, enable Apple, enable demo, Save.
2. Email/password appear; copy them.
3. App login sheet → email form → `role: reader`.
4. Enable “Disable password login”: demo email still works; owner email fails.
5. Disable demo, Save: email login with those creds fails; reader list shows banned with reason `app-review-demo`.
6. Re-enable: same password, profile name `App Reviewer`.
7. As demo, post a comment and vote a poll; run `resetReviewDemo` from cron admin (or call the business method); comment gone, profile restored, still logged in.

---

## Spec coverage

| Spec section | Task |
|---|---|
| Fixed identity / secrets vs public | 1, 4 |
| `configured` ignores toggle | 2 |
| Switch lifecycle provision/ban/unban | 4, 5 |
| `/sign-in/email` allowlist + `disablePasswordLogin` | 1, 5 |
| `GET /auth/review-demo` | 3, 5, 7 |
| Block owner transfer | 5 |
| Daily reset comments/polls/profile, keep session | 6 |
| Admin copy UI + i18n | 7 |
| No Yohaku changes | Global constraint |

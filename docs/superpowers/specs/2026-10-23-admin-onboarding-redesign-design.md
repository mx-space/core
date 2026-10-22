# Admin onboarding redesign

Date: 2026-10-23
Status: approved (direction and step order agreed in the onboarding artboard); executing inline
Artboard: https://claude.ai/artifact/VAp4pqdXA9N132NAhBgBZ7 (row "草案 v2", boards `New-*.dc.html`)

## Intent

The first-run setup in `apps/admin` (`features/setup`, routes `/setup` and `/setup-api`) asks for too much, in the wrong order, and ends nowhere:

- It asks for API and Gateway addresses by hand, although most deployments are same-origin and the address can be detected.
- The site step asks for four URLs and SEO keywords before anything works.
- Site settings are written before the owner exists; the avatar is a URL field only.
- It ends on a "LINK START" button that drops the owner on an empty dashboard. AI, the product's main selling point, never appears.
- Its look (pill controls, bespoke palette) does not match the dashboard.

The redesign makes setup short, puts the account first, adds AI configuration as a skippable step, ends with clear next actions, and uses the dashboard's own components.

## Goals

- Five steps, in this order (owner confirmed): **Welcome → Account → Site → AI (Providers → Models → Features & languages) → Ready**.
- Every step after Account is skippable without leaving setup in a broken state; everything set here stays editable in Settings.
- The screens look like the dashboard: Design System v2 tokens and the existing primitives (see "Visual language").
- Full-screen layout that holds up from phone width to wide desktop.

## Scope

- mx-core `apps/admin` first, then the same onboarding ported to Byline `apps/admin` (owner decision 2026-10-23). Byline differences: first user via `POST /init/user`, current user via `/users/me`, no owner role.
- Both repos commit and push directly to their main branch (owner decision).

## Non-goals

- No new AI capabilities. The AI step only configures what `AIConfig` already supports.
- No new backend endpoints unless one is strictly required (see "Backend constraints").

## Flow

### 1 · Welcome (unauthenticated, `/setup`)

- Detect the API on load: call `GET /init` against the resolved `API_URL`. On success show a status row "已连接服务端 <API> · <version>" with a "更换" link to `/setup-api`. On failure show an inline error with the same link instead of the choice cards.
- Two choice cards: **全新开始** (default selected) and **从备份恢复**. Restore keeps today's behaviour (`POST /init/restore`, reload on success).
- Primary button 继续.
- Aside: what the following steps configure.

### 2 · Account (unauthenticated until submit)

- Fields: 用户名, 邮箱, 密码 (min 8). Optional avatar picker.
- Submit: `POST /init/owner` with `{ username, password, mail, name: username }`, then sign in with the same credentials through the existing auth client, so the rest of setup runs authenticated. If an avatar was picked, upload it after sign-in (`/files/upload`) and patch the owner's avatar.
- Nickname, homepage and bio are no longer asked for here.
- Aside: Passkey and GitHub/Google as later sign-in options (information only).

### 3 · Site (authenticated)

- Fields: 站点名称 (→ `seo.title`), 前台地址 (→ `url.webUrl`).
- Collapsed "服务地址 · 已自动识别" block showing the derived `url.serverUrl` (= resolved `API_URL`), `url.adminUrl` (= current admin origin + path), `url.wsUrl` (= gateway / API origin). Editable when expanded.
- Saved through the authenticated config endpoints the Settings pages already use (not `/init/configs`, which is closed once the owner exists).
- Aside: browser-tab preview of name + URL.

### 4 · AI (authenticated, whole step skippable via "跳过 AI")

4a **Providers** — preset buttons Anthropic / OpenAI / OpenRouter / OpenAI 兼容 (map to the existing provider types and presets used by `AIProviderPresetModal`/`AIProviderDrawer`); API Key; Base URL with preset default; "测试" via `POST /ai/test`, model list via `POST /ai/models/list`. Aside lists added providers; more than one can be added.

4b **Models** — one default model (applied to every assignment that is left at "跟随默认"), plus per-feature overrides: 写作助手 `writerModel`, 摘要 `summaryModel`, 翻译 `translationModel`, 翻译审校 `translationReviewModel`, Insight `insightsModel`, 语音朗读 `tts.model`, 生图 `imageGeneration.model`. Rows whose capability no added provider supports are disabled with a reason.

4c **Features & languages** — switches for 翻译 (`enableTranslation`, target languages chips → `translationTargetLanguages`), 摘要 (`enableSummary`, languages follow translation targets unless set separately → `summaryTargetLanguages`), Insight (`enableInsights`), 语音朗读 (`tts.enable`, disabled when unsupported). Aside: reader-facing preview (language switcher + AI summary).

The "发布时：询问我 / 自动翻译 / 不翻译" control from the artboard ships only if an existing setting backs it. Publishing already asks per job (`aiResources`, see `2026-09-29-publish-ai-resource-modes-design.md`); if no persisted default exists, drop the control rather than adding a setting.

### 5 · Ready (authenticated)

- Three next-action links: 写第一篇文章 (editor), 连接前台主题 (docs link), 导入旧内容 (existing import/backup entry).
- Aside: summary of what was set, each with a 修改 link to the matching Settings page.
- Primary 进入后台 → dashboard.

## Resuming and leaving

- Steps 3–5 run after the owner exists, so `/setup` can no longer be the gate for them. Put them on an authenticated route (e.g. `/onboarding`), reached automatically after Account. Refreshing or leaving mid-way must not lose completed steps (each step saves on 继续).
- The owner can leave at any point ("稍后再说"). Until Ready is reached, the dashboard shows a dismissible "继续设置" entry. Persisting "onboarding finished/dismissed" client-side (localStorage keyed by owner id) is acceptable; no server flag.
- Existing installs that are already initialised never see onboarding.

## Visual language (must match the dashboard)

- Background: the light-blue-to-white gradient already chosen for auth screens (`lib/auth-backdrop.ts`). Screens stay light in dark mode (`.auth-light`), using the dashboard's light token values.
- Layout: left rail (≤240px) with brand + step list styled like `sidebar-nav-item` (h-8 rows, active `bg-black/[0.04]`, AI sub-steps indented); content = one card (`bg-surface-card`, `border-border`, `rounded-lg`, `shadow-sm`) with header / body / footer (footer `bg-surface-page`, actions right-aligned, 返回 on the left); an aside card to the right that wraps below at narrow widths; rail becomes a top row on phones.
- Controls: `~/ui/primitives/button` (primary/secondary/ghost), `TextInput`/`inputBaseClassName`, `Switch`, `SegmentedControl`, `Select`/`Combobox`; accent `#2563eb`. Typography per `apps/admin/AGENTS.md` (heading `text-2xl`, body `text-sm`/`text-base`, no arbitrary sizes).
- Copy in zh-CN and en-US i18n resources; remove keys that no longer have a screen.

## Backend constraints (verified)

- `InitGuard` closes every `/init/*` route once an owner exists (`checkInit` counts `role = 'owner'`), so Site and AI must use authenticated endpoints.
- `POST /ai/test`, `POST /ai/models/list` and `/files/upload` require auth.
- `POST /init/owner` already exists; sign-in uses the existing Better Auth client.

## Left to the builder

- Exact route names and how `/setup` hands over to the authenticated part.
- Whether the old `/setup-api` page stays as a manual fallback (it should, restyled as already done).
- Reuse vs. extraction of the Settings › AI field components inside onboarding (prefer reuse of `AIModelAssignmentField`, provider presets).
- Tests: unit tests for URL derivation and step state; existing setup tests updated.

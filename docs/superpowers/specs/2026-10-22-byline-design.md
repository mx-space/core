# Byline: a slim, multi-author, AI-native headless CMS derived from mx-core

Date: 2026-10-22
Status: draft, pending approval
Name: **Byline**, chosen by the author. Repository: `github.com/mx-space/byline`. Byline's own npm packages (api-client and so on) use the `@mx-space/byline-*` scope; the builder picks the exact names.

## Intent

Product sites and landing pages often carry a blog. At LobeHub that blog lives
as MDX files in the landing repo (`lobehub-landing`, `docs/blogs/{category}/{slug}/index.{locale}.mdx`).
Writers, who are mostly operations staff with some engineers, hand-write MDX
with no live preview and no AI help. They then push to git and wait for a build.
Translation into roughly 18 locales is a separate `lobe-i18n` run.

mx-core already solves most of this. It has a WYSIWYG Lexical editor (haklex),
AI writing assistance, translation, summary, insights and TTS. It is too heavy
for this use, though: it carries notes, says, comments, links, subscriptions and
other personal-blog features. It is also single-user, with one `owner` role, so
posts cannot carry their own authors.

The project is a slim, public, open-source headless CMS derived from mx-core.
The author maintains it personally as a general "landing blog CMS"; it is not a
LobeHub-internal tool. LobeHub's landing is the first consumer.

## Goals

- Multiple users, each with their own account, write and publish posts.
- A WYSIWYG editor is the preview. No separate preview surface.
- AI assistance comes built in: writing assist, translation, summary, insights and TTS.
- API-only delivery. Consumers fetch posts as Lexical JSON plus metadata and render them themselves.
- Deploys with Docker on PostgreSQL.
- The `mxs` CLI works against it.
- Shared logic with mx-core lives in npm packages both projects consume, so fixes land once.

## Non-goals (v1)

- Comments, notes, says, links, subscriptions, recently, polls, serverless, feeds, topics, and the other mx-core personal-blog modules.
- Permission enforcement. The data model reserves room for it, but v1 does not check it.
- A preview of the post rendered inside the consumer's site.
- A rendering package. Consumers render Lexical JSON with haklex packages directly.
- Any consumer-specific code: LobeHub components, the LobeHub landing integration, and LobeHub's MDX migration run all live outside this repo.

## Anti-goals

- Hardcoding anything consumer-specific into the CMS core, such as LobeHub categories, locales, author lists or components.
- Forking mx-core logic by copy-paste so the two codebases drift. Shared logic goes through packages (see "Relationship with mx-core").

## Decisions made by the author

### Accounts and authorship

- Multiple users, each with their own login.
- A new post's author defaults to the logged-in user. Co-authors can be added by hand. `authors` is an ordered list of user ids, and the order is the byline order.
- Permissions are deferred, but the user record reserves a bitmask field, for example
  `EDIT_POST`, `EDIT_OTHERS_POST`, `MANAGE_SETTINGS`, `MANAGE_USERS`. In v1
  every user has all bits. Adding enforcement later must not need a schema change.

### v1 feature inventory

Proposed by the designer from mx-core's modules. The author has reviewed the
list but not confirmed each item. Comments are removed entirely, on both server and admin.

**Settings, kept:**
- Site URLs: `webUrl`, `adminUrl`, `serverUrl`.
- AI: models, target languages for translation, summary and insights, TTS, and image generation (for covers).
- Storage: image storage (S3 and the like) and file upload options.
- Login and security: OAuth, Passkey, auth security options.
- Mail: SMTP or Resend, used only for invites and password reset.

**Settings, new:** category management; the dynamic component catalog (below);
webhooks, so consumers can revalidate on publish.

**Settings, dropped:** site SEO (consumers own it; per-post SEO stays), comments,
comment uploads, Bark, friend links, Baidu/Bing push, feature toggles,
third-party integrations, membership, backup, maintenance, snippets.

**Posts:**
- Kept: `title`, `slug`, `content` (Lexical only), `summary`/excerpt, `images`,
  `meta`, `tags`, `categoryId`, `isPublished`, `pinAt`/`pinOrder`, and the timestamps.
- New: `authors[]`, `sourceLang`, cover `image`, and `seo{title,description,image}`,
  matching the LobeHub landing's `BlogPost` shape.
- Dropped: `isPremium`, `readCount`, `likeCount`, `copyright`, related posts.
- Mechanisms kept: drafts, the revision tree, publish jobs with AI resources, and translations.

**Users:**
- A user list, invites, and deactivation. Deactivation keeps the user's posts and byline.
- Profile editing: display name, avatar, bio, URL.
- Profile-only authors who cannot log in.
- Self-service account settings: password, Passkey, sessions, API keys, OAuth bindings.
- A `permissions` bitmask is stored but not shown in the UI.

**Files:**
- Kept: browsing by type, upload, search, preview, delete, and orphan-file cleanup (reference reconciliation).
- Dropped: comment images and reader upload quotas.

### Dynamic component catalog

- Kept from mx-core. The admin keeps `DynamicCatalogEntry` (`name`, `description`,
  `url`, `propsSchema`, `initialHeight`). The write agent's flow also stays:
  generate a dynamic component, upload its JS as a file, then register it in the
  catalog (`publish-dynamic-component.ts`). Rendering still validates URLs with `isAllowedDynamicUrl`.
  This flow is the "AI-assisted component authoring" the writers asked for.
- Storage moves from the `dynamic-widgets-catalog` data snippet to dedicated CMS
  storage, either its own table or a settings entry (the builder decides). The
  snippet module is not carried over. The admin keeps the same calling interface;
  only the storage layer changes.
- Registering a component should append on the server atomically, replacing
  mx-core's client-side read-modify-write, because the CMS has several concurrent writers.

### Content format and rendering

- Posts are stored and served as Lexical JSON. The CMS does not convert to MDX or Markdown for delivery.
- Consumers render with haklex renderers on their side.
- Site-specific components use haklex Dynamic Nodes (`@haklex/rich-ext-dynamic`).
  A node stores `{ url, props }`. The URL points to an ES module that implements
  `mount(container, { host, props })` from `@haklex/rich-dynamic-protocol`. The
  editor mounts it live, and the consumer mounts it the same way. Component code
  is hosted by the consumer, and the CMS stays unaware of what the component is.

### Preview

- The editor's WYSIWYG view is the preview. No consumer-site preview route.

### Translation and AI

- Behaviour matches mx-core's current publish flow: on publish, the
  `PublishConfirmationDialog` asks which AI resources to run, and progress shows in
  `PublishProcessDock`. See `docs/superpowers/specs/2026-09-29-publish-ai-resource-modes-design.md`.
- Settings hold the target languages per resource: `translationTargetLanguages`,
  `summaryTargetLanguages` and `insightsTargetLanguages`, the same shape as in mx-core.
- Summary, insights and TTS are carried over. Consumers decide whether to show them.

### Deployment and delivery

- Public open-source project in its own repository, maintained by the author.
- Ships as a Docker image containing the API server and the admin SPA.
- An api-client package for consumers.
- `mxs` (`@mx-space/cli`) works against it through a profile. This requires the
  post endpoints to keep mx-core's contract: the response envelope, LiteXML
  round-trip, and `post create/get/update/publish` semantics.

### License and scope of an instance

- The new CMS repository and every extracted shared package use the MIT license.
  The author relicenses the extracted code out of `apps/` (AGPLv3 with
  `ADDITIONAL_TERMS.md`) into MIT packages, so LobeHub and others can use it
  commercially. Code that stays in mx-core's `apps/` keeps its current license.
  Each shared package's `license` field and `private` flag are updated accordingly.
- One instance serves one site. No site or tenant column. Multiple sites means multiple deployments.

### Relationship with mx-core

- Shared logic is extracted from mx-core into npm packages that both projects consume. Build on what already exists (`@mx-space/ai`, `@mx-space/editor`, `@mx-space/db-schema`) rather than copy-paste.
- mx-core itself must switch to consuming the extracted packages. A package that only the new CMS uses does not count as shared.
- **mx-core's tables and behaviour do not change.** mx-core stays single-user
  and will never become multi-user. So the shared packages hold pure logic only:
  Lexical translation parsing, translation strategies, prompts, the AI engine
  and LiteXML handling. They reach data through adapter interfaces, and each
  project implements those adapters against its own tables. The CMS owns its own
  schema and migrations (posts with `authors`, users with `permissions`, and so
  on). `@mx-space/db-schema` is not shared.
- Anything shared that behaves differently between the two projects becomes a
  parameter, with mx-core's current behaviour as the default. For example,
  `packages/ai/src/lang.ts` folds `zh-cn` and `zh-tw` into `zh`; that folding
  becomes an option that mx-core keeps on and the CMS turns off.

### Existing LobeHub content (consumer side, informs the design)

- Phase 1: the LobeHub landing reads from two sources, the existing MDX in git and the CMS API. Merge by slug, CMS wins.
- Phase 2: posts move into the CMS gradually until the MDX path is deleted.
- Only the *tool* belongs to this project: a generic MDX import command
  (MDX + frontmatter + per-locale files → Lexical post + translations +
  authors), usable by any MDX-based blog. LobeHub's component mapping (e.g.
  `<Image>`, `<Callout>`, `<Cards>`, `<Video>`, `<Steps>`) is supplied as
  configuration or a plugin, not baked in.

## Calls made during design (not confirmed by the author)

These are the designer's proposals. The author has not decided them and can override any of them.

- **Redis required** *(my call)*: same as mx-core. An earlier idea was to make
  Redis optional, but the task queue, in-flight AI locks, the TTS lock and caching
  all assume Redis, and a second in-memory implementation is not worth it in v1.
- **Regional locales stay distinct** *(my call)*: `zh-CN`, `zh-TW`, `pt-BR` and
  similar are separate translation targets, as LobeHub needs. This only takes the
  folding option from "Relationship with mx-core"; mx-core's behaviour stays the same.
- **Source language** *(my call)*: the site sets a default, and each post can override it.
- **Prose stays in native nodes** *(my call)*: the translation parser cannot see
  inside Dynamic Node `props`. Components that carry prose (callout, steps, cards,
  image, video) map to native haklex nodes. Dynamic Nodes are only for widgets
  with no translatable text, and adding any missing haklex nodes is in scope.
- **Profile-only authors** *(my call)*: a user can exist without credentials,
  for guests, former staff and imported bylines. The MDX import creates such
  profiles for unknown frontmatter authors.
- **Invite-only accounts** *(my call)*: v1 gives everyone every permission
  bit, so there is no open sign-up. Existing users invite new ones.
- **Imported translations are locked** *(my call)*: translations brought in by
  the MDX import carry a manual/locked flag. Publish-time AI translation skips
  locked locales unless the user explicitly asks to regenerate them.
- **Author profile replaces static author lists** *(my call)*: each user
  has display name, avatar, bio, URL. Post responses expand `authors` into
  these profiles so consumers don't keep an `AUTHOR_LIST`.
- **Configurable categories** *(my call)*: categories are managed in admin,
  not an enum.
- **Translations read via `?lang=`** *(my call)*: same contract as mx-core.

## Constraints

- Follow mx-core conventions for the server: NestJS, Drizzle, Zod views, the
  `{ data, meta? }` / `{ error }` envelope, snake_case on the wire, Snowflake
  ids as strings (see `AGENTS.md` "API Response Rules").
- Release-phase migrations with expand-contract, as in mx-core.
- haklex versions pinned, same as mx-core.

## Left to the builder

- Exact package boundaries for the extraction. The AI module
  (`apps/core/src/modules/ai`) is mostly self-contained. It imports from `post`,
  `configs`, `note`, `topic`, `draft` and `category`. A likely split: pure logic
  (Lexical translation parsing, strategies, prompts, the translation engine) goes
  into packages, and the NestJS services stay per app behind small adapter
  interfaces.
- Which admin features (`apps/admin/src/features/write`, settings) are extracted
  as shared packages and which are rebuilt slim in the new repo.
- Auth schema changes for multi-user: generalising beyond the single `owner`
  role in `modules/auth/auth.implement.ts`.
- Ordering of the work. The suggested order is: extract shared packages with
  mx-core still green, then build the new repo, then the MDX import command.

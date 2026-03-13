# Note SEO Slug Design

**Date:** 2026-03-14

**Status:** Approved for implementation after user review

## Goal

Add an optional `slug` field to notes and expose a public note route in the form `/notes/:year/:month/:day/:slug` so the frontend and sitemap can prefer a stable SEO-oriented path while keeping existing `nid` access compatible.

## Scope

This change covers:

- Core note data model and validation
- Note read API for date + slug lookup
- AI-assisted note slug generation on create when AI writer is configured
- Manual slug edits in admin
- `slugTracker` integration for historical note paths
- API client SDK updates
- Admin note list and note write drawer updates
- Sitemap preference for the new note URL

This change does not remove or replace the existing `nid`-based note route.

## Product Decisions

- `note.slug` is optional.
- New notes may auto-fill `slug` from AI using the note title.
- If AI writer is not configured, auto-generation is skipped silently.
- Admin can manually edit `slug` later.
- Public SEO path is `/notes/:year/:month/:day/:slug`.
- Existing `nid`-based access remains available for backward compatibility.
- Sitemap generation must prefer the new date + slug URL whenever a note has a slug.

## Data Model

### Note Model

Add `slug?: string` to the note model and note DTO/types.

Constraints:

- Stored as normalized slug text via `slugify`
- Unique when present
- Sparse/optional so existing notes without slug remain valid

Expected touch points:

- `apps/core/src/modules/note/note.model.ts`
- `apps/core/src/modules/note/note.schema.ts`
- `packages/api-client/models/note.ts`
- `../admin-vue3/src/models/note.ts`
- `../admin-vue3/src/api/notes.ts`

## Backend Behavior

### Create Flow

On note creation:

1. If request payload already contains `slug`, normalize and validate it.
2. If `slug` is absent and title exists, attempt AI slug generation.
3. Only attempt AI generation when AI writer runtime is configured and available.
4. If AI is unavailable or not configured, keep `slug` undefined.
5. If a generated or provided slug is already occupied by another note, reject with slug-not-available semantics.

Implementation should avoid implicit non-AI fallback generation because the requested behavior is "AI if configured, otherwise skip".

### Update Flow

On note update:

- If `slug` is present in the payload, normalize it.
- If normalized slug differs from the existing stored slug, validate uniqueness.
- If slug changes, record the old public path in `slugTracker`.
- Changing title alone does not backfill or rewrite an existing slug automatically.

### Public Lookup Route

Add a new public note route:

- `GET /notes/:year/:month/:day/:slug`

Lookup behavior:

1. Normalize the incoming slug.
2. Build the requested day range from `year/month/day`.
3. Query note by `slug` + created time range.
4. Apply the same public visibility rules used by existing public note reads.
5. If not found, check `slugTracker` using the full historical path.
6. If tracker resolves to a note, load that note and verify the note's current created date still matches the requested day range.
7. Return 404 when the path date and the note's current created date do not match.

The route should return the same payload shape as the existing single-note public API so frontend integration stays simple.

### Slug Tracker

Track note path history using the full public route:

- `/${year}/${month}/${day}/${slug}` stored with `ArticleTypeEnum.Note`

Required behavior:

- Create tracker on slug change
- Delete trackers when a note is deleted
- Resolve historical routes in the new date + slug lookup

### Sitemap

When generating sitemap URLs for notes:

- Prefer `/notes/:year/:month/:day/:slug` if the note has `slug`
- Fall back to the existing `nid`-based or legacy note URL when `slug` is absent

This change is explicitly required to improve note SEO weight.

## API Client SDK

Update note client interfaces to include the new field and route helper.

Required changes:

- Add `slug?: string` to note model
- Add a note controller method like `getNoteBySlugDate(year, month, day, slug, options?)`
- Keep existing `getNoteById` and `getNoteByNid` behavior unchanged
- Add SDK tests for the new method

## Admin

### Note List

Expose slug in the note management list:

- Include `slug` in `select`
- Add a visible slug column in desktop table
- Add slug metadata in mobile card list
- Show `-` or `—` when slug is missing

### Note Write Drawer

Expose slug input in the note write drawer:

- Add editable `slug` field to the reactive note state
- Populate it when loading an existing note or applying a draft
- Send it in create/update payloads
- Reuse the existing slug input pattern used by post/page where practical

### AI Assistance

The note write page already has AI helper integration. After backend support lands:

- Note draft/editor state should carry `slug`
- AI helper can fill `slug` based on title/text in the same way post/page already does
- Backend remains the source of truth for creation-time auto-generation

## Testing

### Core Tests

Add or update tests for:

- Note create with explicit slug
- Note create without slug and AI writer configured
- Note create without slug and no AI writer configured
- Note update with slug change creating tracker
- Note delete cleaning trackers
- `GET /notes/:year/:month/:day/:slug` success
- Historical slug resolution via tracker
- 404 when date segment does not match note created date
- Public visibility restrictions still enforced

### SDK Tests

Add controller tests for:

- New note date + slug method path generation
- Query option passthrough if options are supported

### Admin Verification

Verify:

- Note list displays slug
- Write drawer persists slug in create/edit
- Existing notes without slug still render and save correctly

## Risks and Guardrails

- Route ordering matters because the new dynamic route must not shadow existing note endpoints.
- Sparse unique indexing must be configured correctly or existing slug-less notes may fail writes.
- Historical tracker paths must include the note date segment; using slug alone is insufficient.
- Sitemap changes must not break existing note URLs for notes without slug.
- AI slug generation must not hard-fail note creation when AI is disabled.

## Implementation Notes

- Follow TDD for backend route and service behavior.
- Reuse existing post/page slug validation and `slugTracker` patterns where possible.
- Keep the change incremental: add the new SEO path without removing current note access paths.

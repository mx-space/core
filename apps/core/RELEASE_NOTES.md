## TL;DR

Adds an authenticated TMDB search API powering the Space app's new movie/TV search composer for Recently posts.

## Highlights

The enrichment module gains a search surface: `GET /enrichment/search/:provider` lets authenticated clients query a provider by keyword. The TMDB provider implements it via TMDB's multi-search, returning normalized movie/TV results (title, overview, poster, rating, genres) with locale-aware output and en-US backfill for untranslated entries.

On top of this API, the Space iOS app ships a `/tmdb` slash command in the Recently composer: search TMDB inline, pick a result, and attach the movie or show card to your post.

## Changes

### Features

- New authenticated `GET /enrichment/search/:provider` endpoint with TMDB multi-search support, plus the Space app's TMDB search composer ([#2808](https://github.com/mx-space/core/pull/2808))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.27.0...v13.28.0

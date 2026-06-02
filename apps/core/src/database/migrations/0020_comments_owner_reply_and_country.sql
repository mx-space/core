-- Expand-only addition of two columns on `comments`, both backward-compatible
-- per docs/superpowers/specs/2026-06-02-admin-comments-redesign-design.md §6.5.
--
-- `is_owner_reply` is set by the reply mutation when the actor is the site
-- owner; defaults FALSE so old writes (and the previous app version during the
-- Dokploy rolling cutover) leave it as the safe baseline.
-- `country_code` is populated at write time by the comment country
-- enrichment service; nullable so backfill can proceed lazily.
ALTER TABLE "comments" ADD COLUMN "is_owner_reply" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "country_code" text;

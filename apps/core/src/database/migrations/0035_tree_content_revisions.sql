UPDATE "drafts"
SET
	"meta" = NULLIF("meta" - 'preGenerateAiResources', '{}'::jsonb),
	"type_specific_data" = NULLIF(
		"type_specific_data" - 'isPublished' - 'migration' - 'passwordProtected',
		'{}'::jsonb
	)
WHERE
	COALESCE("meta" ? 'preGenerateAiResources', false)
	OR COALESCE("type_specific_data" ?| ARRAY['isPublished', 'migration', 'passwordProtected'], false);
--> statement-breakpoint
UPDATE "posts"
SET "meta" = NULLIF("meta" - 'preGenerateAiResources', '{}'::jsonb)
WHERE COALESCE("meta" ? 'preGenerateAiResources', false);
--> statement-breakpoint
UPDATE "notes"
SET "meta" = NULLIF("meta" - 'preGenerateAiResources', '{}'::jsonb)
WHERE COALESCE("meta" ? 'preGenerateAiResources', false);
--> statement-breakpoint
UPDATE "drafts"
SET "type_specific_data" = jsonb_set(
	COALESCE("type_specific_data", '{}'::jsonb),
	'{pin}',
	to_jsonb(
		CASE
			WHEN jsonb_typeof("type_specific_data"->'pin') = 'boolean'
				THEN ("type_specific_data"->>'pin')::boolean
			WHEN "type_specific_data"->>'pin' IS NULL OR "type_specific_data"->>'pin' = ''
				THEN false
			ELSE true
		END
	)
)
WHERE "ref_type" = 'post' AND COALESCE("type_specific_data" ? 'pin', false);
--> statement-breakpoint
UPDATE "drafts"
SET "type_specific_data" = NULLIF("type_specific_data" - 'password', '{}'::jsonb)
WHERE "ref_type" = 'note' AND "type_specific_data"->>'password' = '';
--> statement-breakpoint
UPDATE "drafts" AS d
SET "published_version" = d."version"
FROM "posts" AS p
WHERE
	d."ref_type" = 'post'
	AND d."ref_id" = p."id"
	AND d."published_version" IS NULL
	AND d."title" = p."title"
	AND d."text" = COALESCE(p."text", '')
	AND COALESCE(d."content", '') = COALESCE(p."content", '')
	AND d."content_format" = p."content_format"
	AND COALESCE(d."images", '[]'::jsonb) = COALESCE(p."images", '[]'::jsonb)
	AND COALESCE(d."meta", '{}'::jsonb) = COALESCE(p."meta", '{}'::jsonb)
	AND COALESCE(d."type_specific_data"->>'slug', p."slug") = p."slug"
	AND COALESCE(d."type_specific_data"->>'summary', '') = COALESCE(p."summary", '')
	AND COALESCE((d."type_specific_data"->>'copyright')::boolean, p."copyright") = p."copyright"
	AND COALESCE((d."type_specific_data"->>'isPremium')::boolean, p."is_premium") = p."is_premium"
	AND COALESCE((d."type_specific_data"->>'pin')::boolean, p."pin_at" IS NOT NULL) = (p."pin_at" IS NOT NULL)
	AND COALESCE((d."type_specific_data"->>'pinOrder')::integer, p."pin_order", 0) = COALESCE(p."pin_order", 0)
	AND COALESCE(d."type_specific_data"->>'categoryId', p."category_id") = p."category_id"
	AND COALESCE(
		(
			SELECT jsonb_agg(value ORDER BY value)
			FROM jsonb_array_elements_text(COALESCE(d."type_specific_data"->'tags', '[]'::jsonb))
		),
		'[]'::jsonb
	) = to_jsonb(ARRAY(SELECT unnest(p."tags") ORDER BY 1))
	AND COALESCE(
		(
			SELECT jsonb_agg(value ORDER BY value)
			FROM jsonb_array_elements_text(COALESCE(d."type_specific_data"->'relatedId', '[]'::jsonb))
		),
		'[]'::jsonb
	) = COALESCE(
		(
			SELECT jsonb_agg(pr."related_post_id" ORDER BY pr."related_post_id")
			FROM "post_related_posts" AS pr
			WHERE pr."post_id" = p."id"
		),
		'[]'::jsonb
	);
--> statement-breakpoint
UPDATE "drafts" AS d
SET "published_version" = d."version"
FROM "notes" AS n
WHERE
	d."ref_type" = 'note'
	AND d."ref_id" = n."id"
	AND d."published_version" IS NULL
	AND d."title" = COALESCE(n."title", '')
	AND d."text" = COALESCE(n."text", '')
	AND COALESCE(d."content", '') = COALESCE(n."content", '')
	AND d."content_format" = n."content_format"
	AND COALESCE(d."images", '[]'::jsonb) = COALESCE(n."images", '[]'::jsonb)
	AND COALESCE(d."meta", '{}'::jsonb) = COALESCE(n."meta", '{}'::jsonb)
	AND COALESCE(d."type_specific_data"->>'slug', '') = COALESCE(n."slug", '')
	AND COALESCE(d."type_specific_data"->>'mood', '') = COALESCE(n."mood", '')
	AND COALESCE(d."type_specific_data"->>'weather', '') = COALESCE(n."weather", '')
	AND COALESCE((d."type_specific_data"->>'bookmark')::boolean, n."bookmark") = n."bookmark"
	AND COALESCE(d."type_specific_data"->>'location', '') = COALESCE(n."location", '')
	AND COALESCE(d."type_specific_data"->>'topicId', '') = COALESCE(n."topic_id", '')
	AND (
		NOT COALESCE(d."type_specific_data" ? 'password', false)
		OR d."type_specific_data"->>'password' IS NOT DISTINCT FROM n."password"
	)
	AND COALESCE(d."type_specific_data"->'coordinates', 'null'::jsonb) = COALESCE(n."coordinates", 'null'::jsonb)
	AND COALESCE(d."type_specific_data"->>'publicAt', '') = COALESCE(to_jsonb(n."public_at") #>> '{}', '');
--> statement-breakpoint
UPDATE "drafts" AS d
SET "published_version" = d."version"
FROM "pages" AS p
WHERE
	d."ref_type" = 'page'
	AND d."ref_id" = p."id"
	AND d."published_version" IS NULL
	AND d."title" = p."title"
	AND d."text" = COALESCE(p."text", '')
	AND COALESCE(d."content", '') = COALESCE(p."content", '')
	AND d."content_format" = p."content_format"
	AND COALESCE(d."images", '[]'::jsonb) = COALESCE(p."images", '[]'::jsonb)
	AND COALESCE(d."meta", '{}'::jsonb) = COALESCE(p."meta", '{}'::jsonb)
	AND COALESCE(d."type_specific_data"->>'slug', p."slug") = p."slug"
	AND COALESCE(d."type_specific_data"->>'subtitle', '') = COALESCE(p."subtitle", '')
	AND COALESCE((d."type_specific_data"->>'order')::integer, p."order") = p."order";
--> statement-breakpoint
ALTER TABLE "draft_histories" RENAME TO "legacy_draft_histories";
--> statement-breakpoint
-- migration-lint:allow=no-bare-create-index reason=indexes target brand-new empty revision tables; CONCURRENTLY cannot run inside the migration transaction
ALTER TABLE "drafts" RENAME TO "legacy_drafts";
--> statement-breakpoint
DROP INDEX IF EXISTS "drafts_ref_uniq";
--> statement-breakpoint
DROP INDEX IF EXISTS "drafts_ref_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "drafts_updated_at_idx";
--> statement-breakpoint
CREATE TABLE "content_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ref_type" text NOT NULL,
	"ref_id" text,
	"published_revision_id" text
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"parent_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"content" text,
	"content_format" text NOT NULL,
	"images" jsonb,
	"meta" jsonb,
	"type_specific_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"base_revision_id" text NOT NULL,
	"head_revision_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "drafts_status_check" CHECK ("status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "content_publication_events" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"previous_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_parent_revision_id_content_revisions_id_fk" FOREIGN KEY ("parent_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_documents" ADD CONSTRAINT "content_documents_published_revision_id_content_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_base_revision_id_content_revisions_id_fk" FOREIGN KEY ("base_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_head_revision_id_content_revisions_id_fk" FOREIGN KEY ("head_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_publication_events" ADD CONSTRAINT "content_publication_events_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_publication_events" ADD CONSTRAINT "content_publication_events_revision_id_content_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_publication_events" ADD CONSTRAINT "content_publication_events_previous_revision_id_content_revisions_id_fk" FOREIGN KEY ("previous_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "content_documents_ref_uniq" ON "content_documents" USING btree ("ref_type", "ref_id") WHERE "content_documents"."ref_id" is not null;
--> statement-breakpoint
CREATE INDEX "content_revisions_document_idx" ON "content_revisions" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "content_revisions_parent_idx" ON "content_revisions" USING btree ("parent_revision_id");
--> statement-breakpoint
CREATE INDEX "drafts_document_status_idx" ON "drafts" USING btree ("document_id", "status");
--> statement-breakpoint
CREATE INDEX "drafts_updated_at_idx" ON "drafts" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "content_publication_events_document_idx" ON "content_publication_events" USING btree ("document_id", "created_at");

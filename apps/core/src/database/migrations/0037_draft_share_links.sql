CREATE TABLE "content_document_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"token" text NOT NULL,
	"mode" text NOT NULL,
	"revision_id" text,
	"draft_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "content_document_shares_document_uniq" UNIQUE("document_id"),
	CONSTRAINT "content_document_shares_token_uniq" UNIQUE("token"),
	CONSTRAINT "content_document_shares_target_check" CHECK (
		("content_document_shares"."mode" = 'pinned' AND "content_document_shares"."revision_id" IS NOT NULL AND "content_document_shares"."draft_id" IS NULL)
		OR ("content_document_shares"."mode" = 'follow' AND "content_document_shares"."draft_id" IS NOT NULL AND "content_document_shares"."revision_id" IS NULL)
	)
);
--> statement-breakpoint
ALTER TABLE "content_document_shares" ADD CONSTRAINT "content_document_shares_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_document_shares" ADD CONSTRAINT "content_document_shares_revision_id_content_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_document_shares" ADD CONSTRAINT "content_document_shares_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;

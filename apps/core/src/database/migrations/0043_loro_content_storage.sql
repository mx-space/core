-- migration-lint:allow=no-bare-create-index reason=index targets the brand-new empty content_crdt_updates table; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "content_crdt_docs" (
	"document_id" text PRIMARY KEY NOT NULL,
	"snapshot" bytea NOT NULL,
	"snapshot_version" bytea NOT NULL,
	"synced_revision_id" text,
	"fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_crdt_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"bytes" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ADD COLUMN "frontiers" jsonb;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "content_crdt_docs" ADD CONSTRAINT "content_crdt_docs_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_crdt_docs" ADD CONSTRAINT "content_crdt_docs_synced_revision_id_content_revisions_id_fk" FOREIGN KEY ("synced_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_crdt_updates" ADD CONSTRAINT "content_crdt_updates_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_crdt_updates_document_idx" ON "content_crdt_updates" USING btree ("document_id");

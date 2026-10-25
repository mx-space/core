ALTER TABLE "content_documents" ADD COLUMN "crdt_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_crdt_docs" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
UPDATE "content_crdt_docs" SET "edited_at" = coalesce("updated_at", "created_at");

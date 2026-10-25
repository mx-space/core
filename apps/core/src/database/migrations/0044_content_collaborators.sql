CREATE TABLE "content_collaborators" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"reader_id" text NOT NULL,
	"show_in_byline" boolean DEFAULT true NOT NULL,
	"contributed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_collaborators_document_reader_uniq" UNIQUE("document_id","reader_id")
);
--> statement-breakpoint
CREATE TABLE "content_collab_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_collab_invites_token_hash_uniq" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "content_collaborators" ADD CONSTRAINT "content_collaborators_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_collaborators" ADD CONSTRAINT "content_collaborators_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_collab_invites" ADD CONSTRAINT "content_collab_invites_document_id_content_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- migration-lint:allow=no-bare-create-index reason=index targets the brand-new empty content_collab_invites table; CONCURRENTLY cannot run inside the migration transaction
CREATE INDEX "content_collab_invites_document_idx" ON "content_collab_invites" USING btree ("document_id");

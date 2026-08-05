-- migration-lint:allow=no-bare-create-index reason=indexes and FK target the brand-new empty file_usages table; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "file_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_reference_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_field" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_usages" ADD CONSTRAINT "file_usages_file_reference_id_file_references_id_fk" FOREIGN KEY ("file_reference_id") REFERENCES "public"."file_references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_usages_reference_source_uniq" ON "file_usages" USING btree ("file_reference_id","source_type","source_id","source_field");--> statement-breakpoint
CREATE INDEX "file_usages_source_idx" ON "file_usages" USING btree ("source_type","source_id");

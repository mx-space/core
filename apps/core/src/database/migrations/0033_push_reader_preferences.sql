-- Reader push preference rows are expand-only and empty at deploy time.
CREATE TABLE "push_reader_preferences" (
	"reader_id" text PRIMARY KEY NOT NULL,
	"content_post" boolean DEFAULT true NOT NULL,
	"content_note" boolean DEFAULT true NOT NULL,
	"content_recently" boolean DEFAULT true NOT NULL,
	"comment_replied" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "push_reader_preferences" ADD CONSTRAINT "push_reader_preferences_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
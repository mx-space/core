CREATE TABLE "reader_blocks" (
	"blocker_id" text NOT NULL,
	"blocked_reader_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_blocks_pk" PRIMARY KEY("blocker_id","blocked_reader_id"),
	CONSTRAINT "reader_blocks_no_self_check" CHECK ("reader_blocks"."blocker_id" <> "reader_blocks"."blocked_reader_id")
);
--> statement-breakpoint
ALTER TABLE "reader_blocks" ADD CONSTRAINT "reader_blocks_blocker_id_readers_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reader_blocks" ADD CONSTRAINT "reader_blocks_blocked_reader_id_readers_id_fk" FOREIGN KEY ("blocked_reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
UPDATE "options"
SET "value" = jsonb_set(COALESCE("value", '{}'::jsonb), '{antiSpam}', 'true'::jsonb, true)
WHERE "name" = 'commentOptions';

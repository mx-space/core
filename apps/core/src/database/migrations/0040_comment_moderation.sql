ALTER TABLE "comments" ADD COLUMN "moderation_status" text;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "moderation_receipt_hash" text;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "moderation_attempts" integer DEFAULT 0 NOT NULL;

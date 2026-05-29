ALTER TABLE "readers" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "ban_reason" text;
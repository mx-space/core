ALTER TABLE "push_relay_bindings" DROP CONSTRAINT "push_relay_bindings_owner_id_readers_id_fk";
--> statement-breakpoint
ALTER TABLE "push_relay_bindings" ALTER COLUMN "owner_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "push_relay_bindings" ADD CONSTRAINT "push_relay_bindings_owner_id_readers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;

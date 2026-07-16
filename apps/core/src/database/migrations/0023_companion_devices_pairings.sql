-- Companion pairing and device credentials are new expand-only tables. No
-- existing runtime reads them until the authenticated Companion routes ship.
-- migration-lint:allow=no-bare-create-index reason=indexes target brand-new empty companion tables; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "companion_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"presence_cleared_at" timestamp with time zone,
	CONSTRAINT "companion_devices_token_hash_hex_check" CHECK ("companion_devices"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "companion_devices_scopes_array_check" CHECK (jsonb_typeof("companion_devices"."scopes") = 'array')
);
--> statement-breakpoint
CREATE TABLE "companion_pairings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"owner_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "companion_pairings_code_hash_hex_check" CHECK ("companion_pairings"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "companion_pairings_scopes_array_check" CHECK (jsonb_typeof("companion_pairings"."scopes") = 'array'),
	CONSTRAINT "companion_pairings_expiry_check" CHECK ("companion_pairings"."expires_at" > "companion_pairings"."created_at")
);
--> statement-breakpoint
ALTER TABLE "companion_devices" ADD CONSTRAINT "companion_devices_owner_id_readers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "companion_pairings" ADD CONSTRAINT "companion_pairings_owner_id_readers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "companion_devices_token_hash_uniq" ON "companion_devices" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "companion_devices_owner_created_idx" ON "companion_devices" USING btree ("owner_id", "created_at");
--> statement-breakpoint
CREATE INDEX "companion_devices_pending_presence_clear_idx" ON "companion_devices" USING btree ("revoked_at") WHERE "revoked_at" IS NOT NULL AND "presence_cleared_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "companion_pairings_code_hash_uniq" ON "companion_pairings" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX "companion_pairings_owner_created_idx" ON "companion_pairings" USING btree ("owner_id", "created_at");
--> statement-breakpoint
CREATE INDEX "companion_pairings_expires_at_idx" ON "companion_pairings" USING btree ("expires_at");

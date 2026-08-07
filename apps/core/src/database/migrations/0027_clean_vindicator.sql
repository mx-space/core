-- Push Relay source, binding, and outbox tables are expand-only and empty at deploy time.
-- migration-lint:allow=no-bare-create-index reason=indexes and FKs target brand-new empty push tables; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "push_relay_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"remote_binding_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_relay_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"subject" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "push_relay_deliveries_status_check" CHECK ("push_relay_deliveries"."status" in ('pending', 'processing', 'retrying', 'delivered', 'failed')),
	CONSTRAINT "push_relay_deliveries_attempt_check" CHECK ("push_relay_deliveries"."attempt" >= 0)
);
--> statement-breakpoint
CREATE TABLE "push_relay_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"relay_url" text NOT NULL,
	"remote_source_id" text NOT NULL,
	"source_secret" text NOT NULL,
	"event_endpoint" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "push_relay_bindings" ADD CONSTRAINT "push_relay_bindings_source_id_push_relay_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."push_relay_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_relay_bindings" ADD CONSTRAINT "push_relay_bindings_owner_id_readers_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_relay_deliveries" ADD CONSTRAINT "push_relay_deliveries_source_id_push_relay_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."push_relay_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_relay_bindings_remote_uniq" ON "push_relay_bindings" USING btree ("source_id","remote_binding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_relay_bindings_installation_uniq" ON "push_relay_bindings" USING btree ("source_id","installation_id");--> statement-breakpoint
CREATE INDEX "push_relay_bindings_owner_active_idx" ON "push_relay_bindings" USING btree ("owner_id","created_at") WHERE "push_relay_bindings"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "push_relay_deliveries_event_uniq" ON "push_relay_deliveries" USING btree ("source_id","event_id");--> statement-breakpoint
CREATE INDEX "push_relay_deliveries_due_idx" ON "push_relay_deliveries" USING btree ("next_attempt_at","created_at") WHERE "push_relay_deliveries"."status" in ('pending', 'retrying');--> statement-breakpoint
CREATE UNIQUE INDEX "push_relay_sources_relay_url_uniq" ON "push_relay_sources" USING btree ("relay_url");--> statement-breakpoint
CREATE UNIQUE INDEX "push_relay_sources_remote_source_uniq" ON "push_relay_sources" USING btree ("relay_url","remote_source_id");--> statement-breakpoint
CREATE INDEX "push_relay_sources_enabled_idx" ON "push_relay_sources" USING btree ("enabled");

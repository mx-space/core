-- migration-lint:allow=no-bare-create-index reason=indexes and FK target brand-new empty membership/billing tables; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "billing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"reader_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_premium" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_webhook_events_provider_event_id_uniq" ON "billing_webhook_events" USING btree ("provider","event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_reader_id_uniq" ON "memberships" USING btree ("reader_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_provider_subscription_id_uniq" ON "memberships" USING btree ("provider_subscription_id") WHERE "memberships"."provider_subscription_id" is not null;

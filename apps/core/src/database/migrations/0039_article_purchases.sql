-- migration-lint:allow=no-bare-create-index reason=indexes and FK target the brand-new empty article_purchases table; CONCURRENTLY cannot run inside the migration transaction
CREATE TABLE "article_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"reader_id" text NOT NULL,
	"post_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text NOT NULL,
	"provider_customer_id" text,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_purchases" ADD CONSTRAINT "article_purchases_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "article_purchases" ADD CONSTRAINT "article_purchases_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "article_purchases_reader_id_post_id_uniq" ON "article_purchases" USING btree ("reader_id","post_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "article_purchases_provider_payment_id_uniq" ON "article_purchases" USING btree ("provider","provider_payment_id");

CREATE TABLE "ai_agent_conversations" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ref_id" bigint NOT NULL,
	"ref_type" text NOT NULL,
	"title" text,
	"messages" jsonb NOT NULL,
	"model" text NOT NULL,
	"provider_id" text NOT NULL,
	"review_state" jsonb,
	"diff_state" jsonb,
	"message_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ref_id" bigint NOT NULL,
	"lang" text NOT NULL,
	"hash" text NOT NULL,
	"content" text NOT NULL,
	"is_translation" boolean DEFAULT false NOT NULL,
	"source_insights_id" bigint,
	"source_lang" text,
	"model_info" jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" text NOT NULL,
	"summary" text NOT NULL,
	"ref_id" bigint NOT NULL,
	"lang" text
);
--> statement-breakpoint
CREATE TABLE "ai_translations" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hash" text NOT NULL,
	"ref_id" bigint NOT NULL,
	"ref_type" text NOT NULL,
	"lang" text NOT NULL,
	"source_lang" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"subtitle" text,
	"summary" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_modified_at" timestamp with time zone,
	"ai_model" text,
	"ai_provider" text,
	"content_format" text,
	"content" text,
	"source_block_snapshots" jsonb,
	"source_meta_hashes" jsonb
);
--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" bigint PRIMARY KEY NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" bigint NOT NULL,
	"title" text NOT NULL,
	"search_text" text NOT NULL,
	"terms" text[] DEFAULT '{}'::text[] NOT NULL,
	"title_term_freq" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"body_term_freq" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title_length" integer DEFAULT 0 NOT NULL,
	"body_length" integer DEFAULT 0 NOT NULL,
	"slug" text,
	"nid" integer,
	"is_published" boolean DEFAULT true NOT NULL,
	"public_at" timestamp with time zone,
	"has_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "translation_entries" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_path" text NOT NULL,
	"lang" text NOT NULL,
	"key_type" text NOT NULL,
	"lookup_key" text NOT NULL,
	"source_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"source_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"account_id" text,
	"provider_id" text NOT NULL,
	"provider_account_id" text,
	"password" text,
	"type" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_id" text,
	"reference_id" text,
	"config_id" text,
	"name" text,
	"key" text NOT NULL,
	"start" text,
	"prefix" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"refill_interval" integer,
	"refill_amount" integer,
	"expires_at" timestamp with time zone,
	"last_refill_at" timestamp with time zone,
	"last_request" timestamp with time zone,
	"permissions" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "owner_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reader_id" text NOT NULL,
	"mail" text,
	"url" text,
	"introduce" text,
	"last_login_ip" text,
	"last_login_time" timestamp with time zone,
	"social_ids" jsonb
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"name" text,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text[],
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "readers" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"handle" text,
	"username" text,
	"display_username" text,
	"image" text,
	"role" text DEFAULT 'reader' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"provider" text
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" bigint NOT NULL,
	"author" text,
	"mail" text,
	"url" text,
	"text" text NOT NULL,
	"state" integer DEFAULT 0 NOT NULL,
	"parent_comment_id" bigint,
	"root_comment_id" bigint,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"latest_reply_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"ip" text,
	"agent" text,
	"pin" boolean DEFAULT false NOT NULL,
	"location" text,
	"is_whispers" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"auth_provider" text,
	"meta" text,
	"reader_id" text,
	"edited_at" timestamp with time zone,
	"anchor" jsonb
);
--> statement-breakpoint
CREATE TABLE "draft_histories" (
	"id" bigint PRIMARY KEY NOT NULL,
	"draft_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"text" text,
	"content" text,
	"content_format" text NOT NULL,
	"type_specific_data" jsonb,
	"saved_at" timestamp with time zone NOT NULL,
	"is_full_snapshot" boolean NOT NULL,
	"ref_version" integer,
	"base_version" integer
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"ref_type" text NOT NULL,
	"ref_id" bigint,
	"title" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"content" text,
	"content_format" text NOT NULL,
	"images" jsonb,
	"meta" jsonb,
	"type_specific_data" jsonb,
	"history" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"published_version" integer
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nid" integer NOT NULL,
	"title" text,
	"slug" text,
	"text" text,
	"content" text,
	"content_format" text NOT NULL,
	"images" jsonb,
	"meta" jsonb,
	"is_published" boolean DEFAULT true NOT NULL,
	"password" text,
	"public_at" timestamp with time zone,
	"mood" text,
	"weather" text,
	"bookmark" boolean DEFAULT false NOT NULL,
	"coordinates" jsonb,
	"location" text,
	"read_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"topic_id" bigint,
	"modified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"subtitle" text,
	"text" text,
	"content" text,
	"content_format" text NOT NULL,
	"images" jsonb,
	"meta" jsonb,
	"order" integer DEFAULT 1 NOT NULL,
	"modified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_related_posts" (
	"post_id" bigint NOT NULL,
	"related_post_id" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"text" text,
	"content" text,
	"content_format" text NOT NULL,
	"summary" text,
	"images" jsonb,
	"meta" jsonb,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"modified_at" timestamp with time zone,
	"category_id" bigint NOT NULL,
	"copyright" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"pin_at" timestamp with time zone,
	"pin_order" integer
);
--> statement-breakpoint
CREATE TABLE "recentlies" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb,
	"ref_type" text,
	"ref_id" bigint,
	"comments_index" integer DEFAULT 0 NOT NULL,
	"allow_comment" boolean DEFAULT true NOT NULL,
	"modified_at" timestamp with time zone,
	"up" integer DEFAULT 0 NOT NULL,
	"down" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"introduce" text,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "auth_id_map" (
	"collection" text NOT NULL,
	"mongo_id" text NOT NULL,
	"pg_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_migration_runs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "mongo_id_map" (
	"collection" text NOT NULL,
	"mongo_id" text NOT NULL,
	"snowflake_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"name" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" integer,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "analyzes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"ip" text,
	"ua" jsonb,
	"country" text,
	"path" text,
	"referer" text
);
--> statement-breakpoint
CREATE TABLE "file_references" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text NOT NULL,
	"ref_id" bigint,
	"ref_type" text,
	"s3_object_key" text,
	"reader_id" text,
	"uploaded_by" text,
	"mime_type" text,
	"byte_size" bigint,
	"detached_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"avatar" text,
	"description" text,
	"type" integer,
	"state" integer,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "meta_presets" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"name" text NOT NULL,
	"content_type" text,
	"description" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "poll_vote_options" (
	"vote_id" bigint NOT NULL,
	"option_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"poll_id" text NOT NULL,
	"voter_fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"preview_url" text,
	"doc_url" text,
	"project_url" text,
	"images" text[],
	"description" text NOT NULL,
	"avatar" text,
	"text" text
);
--> statement-breakpoint
CREATE TABLE "says" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"source" text,
	"author" text
);
--> statement-breakpoint
CREATE TABLE "serverless_logs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"function_id" bigint,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"method" text,
	"ip" text,
	"status" text NOT NULL,
	"execution_time" integer NOT NULL,
	"logs" jsonb,
	"error" jsonb
);
--> statement-breakpoint
CREATE TABLE "serverless_storages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_trackers" (
	"id" bigint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"target_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"type" text,
	"private" boolean DEFAULT false NOT NULL,
	"raw" text NOT NULL,
	"name" text NOT NULL,
	"reference" text DEFAULT 'root' NOT NULL,
	"comment" text,
	"metatype" text,
	"schema" text,
	"method" text,
	"custom_path" text,
	"secret" text,
	"enable" boolean DEFAULT true NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"compiled_code" text
);
--> statement-breakpoint
CREATE TABLE "subscribes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"cancel_token" text NOT NULL,
	"subscribe" integer NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigint PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone,
	"headers" jsonb,
	"payload" jsonb,
	"event" text,
	"response" jsonb,
	"success" boolean,
	"hook_id" bigint NOT NULL,
	"status" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" bigint PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone,
	"payload_url" text NOT NULL,
	"events" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"secret" text NOT NULL,
	"scope" integer
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_source_insights_id_ai_insights_id_fk" FOREIGN KEY ("source_insights_id") REFERENCES "public"."ai_insights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_reference_id_readers_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_readers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_root_comment_id_comments_id_fk" FOREIGN KEY ("root_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_histories" ADD CONSTRAINT "draft_histories_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_related_posts" ADD CONSTRAINT "post_related_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_related_posts" ADD CONSTRAINT "post_related_posts_related_post_id_posts_id_fk" FOREIGN KEY ("related_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote_options" ADD CONSTRAINT "poll_vote_options_vote_id_poll_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."poll_votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_hook_id_webhooks_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_agent_conversations_ref_idx" ON "ai_agent_conversations" USING btree ("ref_id","ref_type");--> statement-breakpoint
CREATE INDEX "ai_agent_conversations_updated_at_idx" ON "ai_agent_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_insights_ref_lang_uniq" ON "ai_insights" USING btree ("ref_id","lang");--> statement-breakpoint
CREATE INDEX "ai_summaries_ref_id_idx" ON "ai_summaries" USING btree ("ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_translations_ref_lang_uniq" ON "ai_translations" USING btree ("ref_id","ref_type","lang");--> statement-breakpoint
CREATE INDEX "ai_translations_ref_id_idx" ON "ai_translations" USING btree ("ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_ref_uniq" ON "search_documents" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "search_documents_published_idx" ON "search_documents" USING btree ("is_published","public_at");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_entries_key_uniq" ON "translation_entries" USING btree ("key_path","lang","key_type","lookup_key");--> statement-breakpoint
CREATE INDEX "translation_entries_path_lang_idx" ON "translation_entries" USING btree ("key_path","lang");--> statement-breakpoint
CREATE INDEX "translation_entries_lookup_key_idx" ON "translation_entries" USING btree ("lookup_key");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_uniq" ON "accounts" USING btree ("provider_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_uniq" ON "api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "owner_profiles_reader_id_uniq" ON "owner_profiles" USING btree ("reader_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_id_uniq" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "readers_email_uniq" ON "readers" USING btree ("email") WHERE "readers"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "readers_username_uniq" ON "readers" USING btree ("username") WHERE "readers"."username" is not null;--> statement-breakpoint
CREATE INDEX "readers_role_idx" ON "readers" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uniq" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_uniq" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uniq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "comments_thread_idx" ON "comments" USING btree ("ref_type","ref_id","parent_comment_id","pin","created_at");--> statement-breakpoint
CREATE INDEX "comments_root_idx" ON "comments" USING btree ("root_comment_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_reader_idx" ON "comments" USING btree ("reader_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_histories_draft_version_uniq" ON "draft_histories" USING btree ("draft_id","version");--> statement-breakpoint
CREATE INDEX "drafts_ref_idx" ON "drafts" USING btree ("ref_type","ref_id") WHERE "drafts"."ref_id" is not null;--> statement-breakpoint
CREATE INDEX "drafts_updated_at_idx" ON "drafts" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_nid_uniq" ON "notes" USING btree ("nid");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_slug_uniq" ON "notes" USING btree ("slug") WHERE "notes"."slug" is not null;--> statement-breakpoint
CREATE INDEX "notes_nid_desc_idx" ON "notes" USING btree ("nid");--> statement-breakpoint
CREATE INDEX "notes_modified_at_idx" ON "notes" USING btree ("modified_at");--> statement-breakpoint
CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notes_topic_id_idx" ON "notes" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_uniq" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pages_order_idx" ON "pages" USING btree ("order");--> statement-breakpoint
CREATE UNIQUE INDEX "post_related_posts_pk" ON "post_related_posts" USING btree ("post_id","related_post_id");--> statement-breakpoint
CREATE INDEX "post_related_posts_related_idx" ON "post_related_posts" USING btree ("related_post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_uniq" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_modified_at_idx" ON "posts" USING btree ("modified_at");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_category_id_idx" ON "posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "recentlies_ref_idx" ON "recentlies" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "recentlies_created_at_idx" ON "recentlies" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_name_uniq" ON "topics" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_uniq" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_id_map_collection_mongo_uniq" ON "auth_id_map" USING btree ("collection","mongo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_id_map_collection_pg_uniq" ON "auth_id_map" USING btree ("collection","pg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mongo_id_map_pk" ON "mongo_id_map" USING btree ("collection","mongo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mongo_id_map_snowflake_uniq" ON "mongo_id_map" USING btree ("snowflake_id");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analyzes_timestamp_idx" ON "analyzes" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "analyzes_timestamp_path_idx" ON "analyzes" USING btree ("timestamp","path");--> statement-breakpoint
CREATE INDEX "analyzes_timestamp_referer_idx" ON "analyzes" USING btree ("timestamp","referer");--> statement-breakpoint
CREATE INDEX "analyzes_timestamp_ip_idx" ON "analyzes" USING btree ("timestamp","ip");--> statement-breakpoint
CREATE INDEX "file_references_file_url_idx" ON "file_references" USING btree ("file_url");--> statement-breakpoint
CREATE INDEX "file_references_ref_idx" ON "file_references" USING btree ("ref_id","ref_type");--> statement-breakpoint
CREATE INDEX "file_references_status_created_idx" ON "file_references" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "file_references_reader_status_created_idx" ON "file_references" USING btree ("reader_id","status","created_at");--> statement-breakpoint
CREATE INDEX "file_references_status_detached_idx" ON "file_references" USING btree ("status","detached_at");--> statement-breakpoint
CREATE UNIQUE INDEX "links_name_uniq" ON "links" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "links_url_uniq" ON "links" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_presets_name_uniq" ON "meta_presets" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "options_name_uniq" ON "options" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_vote_options_pk" ON "poll_vote_options" USING btree ("vote_id","option_id");--> statement-breakpoint
CREATE INDEX "poll_vote_options_option_idx" ON "poll_vote_options" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_poll_voter_uniq" ON "poll_votes" USING btree ("poll_id","voter_fingerprint");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_uniq" ON "projects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "says_created_at_idx" ON "says" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "serverless_logs_created_at_idx" ON "serverless_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "serverless_logs_function_idx" ON "serverless_logs" USING btree ("function_id","created_at");--> statement-breakpoint
CREATE INDEX "serverless_logs_reference_idx" ON "serverless_logs" USING btree ("reference","name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "serverless_storages_ns_key_uniq" ON "serverless_storages" USING btree ("namespace","key");--> statement-breakpoint
CREATE INDEX "slug_trackers_type_target_idx" ON "slug_trackers" USING btree ("type","target_id");--> statement-breakpoint
CREATE INDEX "slug_trackers_slug_type_idx" ON "slug_trackers" USING btree ("slug","type");--> statement-breakpoint
CREATE INDEX "snippets_name_reference_idx" ON "snippets" USING btree ("name","reference");--> statement-breakpoint
CREATE INDEX "snippets_type_idx" ON "snippets" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "snippets_custom_path_uniq" ON "snippets" USING btree ("custom_path") WHERE "snippets"."custom_path" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "subscribes_email_uniq" ON "subscribes" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribes_cancel_token_uniq" ON "subscribes" USING btree ("cancel_token");--> statement-breakpoint
CREATE INDEX "webhook_events_hook_id_idx" ON "webhook_events" USING btree ("hook_id");--> statement-breakpoint
CREATE INDEX "webhook_events_timestamp_idx" ON "webhook_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "webhooks_enabled_idx" ON "webhooks" USING btree ("enabled");
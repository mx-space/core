ALTER TABLE "ai_insights" DROP CONSTRAINT "ai_insights_source_insights_id_ai_insights_id_fk";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_parent_comment_id_comments_id_fk";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_root_comment_id_comments_id_fk";--> statement-breakpoint
ALTER TABLE "draft_histories" DROP CONSTRAINT "draft_histories_draft_id_drafts_id_fk";--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_topic_id_topics_id_fk";--> statement-breakpoint
ALTER TABLE "post_related_posts" DROP CONSTRAINT "post_related_posts_post_id_posts_id_fk";--> statement-breakpoint
ALTER TABLE "post_related_posts" DROP CONSTRAINT "post_related_posts_related_post_id_posts_id_fk";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_category_id_categories_id_fk";--> statement-breakpoint
ALTER TABLE "poll_vote_options" DROP CONSTRAINT "poll_vote_options_vote_id_poll_votes_id_fk";--> statement-breakpoint
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_hook_id_webhooks_id_fk";--> statement-breakpoint
ALTER TABLE "ai_agent_conversations" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_agent_conversations" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_insights" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_insights" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_insights" ALTER COLUMN "source_insights_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_summaries" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_summaries" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_translations" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_translations" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "search_documents" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "search_documents" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "translation_entries" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "parent_comment_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "root_comment_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "draft_histories" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "draft_histories" ALTER COLUMN "draft_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "topic_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "post_related_posts" ALTER COLUMN "post_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "post_related_posts" ALTER COLUMN "related_post_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "category_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recentlies" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recentlies" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "topics" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "data_migration_runs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mongo_id_map" ALTER COLUMN "snowflake_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "analyzes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "file_references" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "file_references" ALTER COLUMN "ref_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meta_presets" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "options" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "poll_vote_options" ALTER COLUMN "vote_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "poll_votes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "says" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "serverless_logs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "serverless_logs" ALTER COLUMN "function_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "serverless_storages" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "slug_trackers" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "slug_trackers" ALTER COLUMN "target_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "snippets" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subscribes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "hook_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "webhooks" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_source_insights_id_ai_insights_id_fk" FOREIGN KEY ("source_insights_id") REFERENCES "public"."ai_insights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_root_comment_id_comments_id_fk" FOREIGN KEY ("root_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_histories" ADD CONSTRAINT "draft_histories_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_related_posts" ADD CONSTRAINT "post_related_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_related_posts" ADD CONSTRAINT "post_related_posts_related_post_id_posts_id_fk" FOREIGN KEY ("related_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote_options" ADD CONSTRAINT "poll_vote_options_vote_id_poll_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."poll_votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_hook_id_webhooks_id_fk" FOREIGN KEY ("hook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "_app_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer
);

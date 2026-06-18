-- migration-lint:allow=no-drop-column,no-bare-create-index reason=snippet VFS cutover replaces legacy name/reference/custom_path addressing; snippets table is small and migrated in a single maintenance step
BEGIN;
--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "path" text;
--> statement-breakpoint
UPDATE "snippets" SET "path" = CASE
  WHEN "reference" = 'skill' THEN 'sk/' || "name" || '/SKILL.md'
  WHEN "custom_path" IS NOT NULL THEN regexp_replace("custom_path", '^/+|/+$', '', 'g')
  WHEN "reference" = 'theme' THEN 'theme/' || "name"
  WHEN "reference" = 'root' THEN 'root/' || "name"
  ELSE "reference" || '/' || "name"
END;
--> statement-breakpoint
DO $$
DECLARE dup_count INT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT "path", "method"
    FROM "snippets"
    GROUP BY "path", "method"
    HAVING count(*) > 1
  ) s;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'path collision detected: % duplicate keys', dup_count;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "snippets" ALTER COLUMN "path" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "snippets_name_reference_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "snippets_custom_path_uniq";
--> statement-breakpoint
CREATE INDEX "snippets_path_prefix_idx" ON "snippets" ("path");
--> statement-breakpoint
CREATE UNIQUE INDEX "snippets_path_idx"
  ON "snippets" ("path") WHERE "method" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "snippets_path_method_idx"
  ON "snippets" ("path", "method") WHERE "method" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "snippets" DROP COLUMN "reference";
--> statement-breakpoint
ALTER TABLE "snippets" DROP COLUMN "name";
--> statement-breakpoint
ALTER TABLE "snippets" DROP COLUMN "custom_path";
--> statement-breakpoint
COMMIT;

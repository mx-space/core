DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "drafts"
		WHERE "ref_id" IS NOT NULL
		GROUP BY "ref_type", "ref_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot enforce drafts_ref_uniq while duplicate referenced drafts exist'
			USING HINT = 'Resolve duplicate drafts sharing the same ref_type and ref_id before rerunning this migration.';
	END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "drafts_ref_uniq" ON "drafts" USING btree ("ref_type","ref_id") WHERE "drafts"."ref_id" is not null;

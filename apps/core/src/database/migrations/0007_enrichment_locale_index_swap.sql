-- migration-lint:allow=no-bare-create-index reason=enrichment_cache is small (cache table); non-concurrent swap locks only milliseconds. Drizzle migrator wraps each migration in a transaction so CONCURRENTLY isn't usable here.
DROP INDEX "enrichment_provider_external_id_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_provider_external_id_locale_uniq" ON "enrichment_cache" USING btree ("provider","external_id","locale");

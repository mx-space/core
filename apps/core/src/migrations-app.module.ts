import { LoggerModule } from '@innei/pretty-logger-nestjs'
import { Global, Module } from '@nestjs/common'

import { AppMigrationsModule } from './database/app-migrations/app-migrations.module'
import { postgresProviders } from './processors/database/postgres.provider'

/**
 * Global sub-module that surfaces the PG pool/db tokens to anything in the
 * MigrationsAppModule tree (notably AppMigrationsService). Kept @Global so
 * AppMigrationsModule does not need to know where its tokens come from —
 * mirrors how the live server's DatabaseModule is global.
 */
@Global()
@Module({
  providers: [...postgresProviders],
  exports: [...postgresProviders],
})
class MigrationsDatabaseModule {}

/**
 * Slim Nest module for the release-phase migrate runner. Exposes only the
 * postgres pool/db tokens and the app-migrations runner — no AuthModule,
 * ImageService (no sharp install), GatewayModule, TaskQueue, Cron, Email,
 * Better Auth init, etc. This keeps `node migrate.mjs` (and the docker
 * `mx-migrate` one-shot container) infrastructure-only: a misbehaving
 * business onModuleInit cannot brick a release.
 *
 * Migrations call into pure utilities (e.g. `~/modules/enrichment/url-match.util`)
 * rather than `app.get(SomeService)`. If a future migration genuinely needs
 * a business service, refactor that service's inputs into a pure helper or
 * have the migration write the data itself and let the live server's
 * background tasks finish the work — do NOT widen this module's imports.
 */
@Module({
  imports: [LoggerModule, MigrationsDatabaseModule, AppMigrationsModule],
})
export class MigrationsAppModule {}

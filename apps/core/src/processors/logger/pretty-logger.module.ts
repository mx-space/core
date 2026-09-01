import { Logger } from '@innei/pretty-logger-nestjs'
import { Global, Module } from '@nestjs/common'

/**
 * Nest 12 marks `ConsoleLogger` `@Injectable()` with optional
 * `(context, options)` constructor tokens. `@innei/pretty-logger-nestjs`
 * 0.4.2 still peers Nest 11 and registers `Logger` as a class provider
 * without `@Optional()`, so Nest tries to inject `Object` and fails
 * (`Logger (?, Object)`). Provide the same class via `useFactory` instead
 * of rewriting the logger or adding `@nestjs/observe`.
 */
@Global()
@Module({
  providers: [
    {
      provide: Logger,
      useFactory: () => new Logger(),
    },
  ],
  exports: [Logger],
})
export class PrettyLoggerModule {}

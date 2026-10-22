export interface AiLogger {
  log: (message: unknown, ...optionalParams: unknown[]) => void
  warn: (message: unknown, ...optionalParams: unknown[]) => void
  error: (message: unknown, ...optionalParams: unknown[]) => void
  debug: (message: unknown, ...optionalParams: unknown[]) => void
}

export type AiLoggerFactory = (context: string) => AiLogger

export interface AiEnvironmentOptions {
  loggerFactory?: AiLoggerFactory
  debug?: boolean
}

const consoleLoggerFactory: AiLoggerFactory = (context) => {
  const prefix = `[${context}]`
  const sink = globalThis.console
  return {
    log: (message, ...rest) => sink.log(prefix, message, ...rest),
    warn: (message, ...rest) => sink.warn(prefix, message, ...rest),
    error: (message, ...rest) => sink.error(prefix, message, ...rest),
    debug: (message, ...rest) => sink.debug(prefix, message, ...rest),
  }
}

const readNodeEnv = (): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.NODE_ENV

const environment: Required<AiEnvironmentOptions> = {
  loggerFactory: consoleLoggerFactory,
  debug: readNodeEnv() === 'development',
}

export function configureAiEnvironment(options: AiEnvironmentOptions): void {
  if (options.loggerFactory) environment.loggerFactory = options.loggerFactory
  if (options.debug !== undefined) environment.debug = options.debug
}

export function isAiDebugEnabled(): boolean {
  return environment.debug
}

export function createAiLogger(context: string): AiLogger {
  return {
    log: (message, ...rest) =>
      environment.loggerFactory(context).log(message, ...rest),
    warn: (message, ...rest) =>
      environment.loggerFactory(context).warn(message, ...rest),
    error: (message, ...rest) =>
      environment.loggerFactory(context).error(message, ...rest),
    debug: (message, ...rest) =>
      environment.loggerFactory(context).debug(message, ...rest),
  }
}

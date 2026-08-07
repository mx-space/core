const DEVELOPMENT_RELAY_ORIGINS = [
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'http://[::1]:8787',
] as const

const isLoopbackHostname = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1'

const normalizeConfiguredOrigin = (
  value: string,
  allowInsecureLoopback: boolean,
) => {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Push Relay origins must not include credentials, a path, query, or fragment',
    )
  }
  if (
    url.protocol !== 'https:' &&
    !(
      allowInsecureLoopback &&
      url.protocol === 'http:' &&
      isLoopbackHostname(url.hostname)
    )
  ) {
    throw new Error('Push Relay origins must use HTTPS in production')
  }
  return url.origin
}

export const configuredPushRelayOrigins = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const isProduction = env.NODE_ENV === 'production'
  const configured = env.MX_PUSH_RELAY_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const candidates =
    configured && configured.length > 0
      ? configured
      : isProduction
        ? []
        : [...DEVELOPMENT_RELAY_ORIGINS]

  return candidates.map((value) =>
    normalizeConfiguredOrigin(value, !isProduction),
  )
}

export const resolveAllowedPushRelayOrigin = (
  requestedOrigin: string,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const isProduction = env.NODE_ENV === 'production'
  const normalizedRequest = normalizeConfiguredOrigin(
    requestedOrigin,
    !isProduction,
  )
  const allowedOrigin = configuredPushRelayOrigins(env).find(
    (origin) => origin === normalizedRequest,
  )
  if (!allowedOrigin) {
    throw new Error(
      'Push Relay origin is not allowed; configure MX_PUSH_RELAY_ORIGINS on mx-core',
    )
  }
  return allowedOrigin
}

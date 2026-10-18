import {
  defineRailway,
  github,
  preserve,
  project,
  service,
  volume,
} from 'railway/iac'

export const partial = 'push-relay'

const startCommand = [
  'umask 077',
  'chown nobody:nogroup /data',
  'relay_key_dir=$(mktemp -d /tmp/push-relay-keys.XXXXXX)',
  'printf "%s" "$PUSH_RELAY_APNS_PRIVATE_KEY" > "$relay_key_dir/AuthKey_T23JLFJTS7.p8"',
  'printf "%s" "$PUSH_RELAY_APNS_SANDBOX_PRIVATE_KEY" > "$relay_key_dir/AuthKey_D8FWJZFNT9.p8"',
  'printf "%s" "$PUSH_RELAY_YOHAKU_APNS_PRIVATE_KEY" > "$relay_key_dir/AuthKey_9KVCS38NGW.p8"',
  'chown nobody:nogroup "$relay_key_dir/"*.p8',
  // Renaming avoids protected /tmp files blocking root on container restart.
  'mv "$relay_key_dir/"*.p8 /tmp/',
  'rmdir "$relay_key_dir"',
  'exec su-exec nobody:nogroup /bin/sh -ec "push-relay migrate; exec push-relay"',
].join('; ')

export default defineRailway(() => {
  const data = volume('push-relay-data', {
    region: 'asia-southeast1-eqsg3a',
    sizeMB: 5000,
  })
  const pushRelay = service('push-relay', {
    source: github('mx-space/core', { branch: 'master' }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'apps/push-relay-rs/Dockerfile',
      watchPatterns: ['/apps/push-relay-rs/**', '/.railway/**'],
    },
    start: `/bin/sh -ec '${startCommand}'`,
    deploy: {
      preDeployCommand: [],
      numReplicas: 1,
      sleepApplication: true,
      restartPolicyMaxRetries: 3,
      limitOverride: { containers: { cpu: 0.1, memoryBytes: 125_000_000 } },
    },
    volumeMounts: { '/data': data },
    healthcheck: '/health',
    healthcheckTimeout: 120,
    env: {
      RAILWAY_DOCKERFILE_PATH: 'apps/push-relay-rs/Dockerfile',
      RAILWAY_RUN_UID: '0',
      PORT: preserve(),
      PUSH_RELAY_PORT: preserve(),
      PUSH_RELAY_PUBLIC_URL: preserve(),
      PUSH_RELAY_DATABASE_PATH: '/data/push-relay.sqlite3',
      PUSH_RELAY_DATA_KEY: preserve(),
      PUSH_RELAY_APPS_JSON: preserve(),
      PUSH_RELAY_APNS_PRIVATE_KEY: preserve(),
      PUSH_RELAY_APNS_SANDBOX_PRIVATE_KEY: preserve(),
      PUSH_RELAY_YOHAKU_APNS_PRIVATE_KEY: preserve(),
    },
  })
  return project('mx-space', { resources: [data, pushRelay] })
})

import { defineConfig, mergeConfig } from 'vite'

import coreConfig from '../../vite.config'

// Keep production transforms/metadata while disabling browser dependency
// prebundling in this one-shot development migration process.
export default defineConfig((environment) =>
  mergeConfig(coreConfig(environment), {
    optimizeDeps: { noDiscovery: true },
  }),
)

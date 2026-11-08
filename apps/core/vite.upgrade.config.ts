import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// Offline tooling needs no application transforms, decorators or dependency optimizer.
export default defineConfig({
  plugins: [tsconfigPaths()],
  optimizeDeps: { noDiscovery: true },
})

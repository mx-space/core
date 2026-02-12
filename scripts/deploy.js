#!/usr/bin/env node
// Backward-compatible entrypoint (root package is CJS).
;(async () => import('./deploy.mjs'))().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

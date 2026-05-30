// Global Vitest setup for the admin app.
//
// Loaded via `test.setupFiles` in `vite.config.mts`. We intentionally keep the
// runtime contract minimal: tests in this repo use `react-dom/client` + raw
// DOM queries against the happy-dom environment (see e.g.
// `src/ui/layout/content-layout.test.tsx`). This file exists as a single
// hook-point for future shared test concerns (matchers, network mocks, etc.)
// without forcing every test to re-import them.

// In production the index.html `html-transform` plugin injects
// `window.injectData = { WEB_URL, GATEWAY, BASE_API }`. Under happy-dom that
// shim is absent, so any module that imports `~/constants/env` (transitively
// many feature/api modules) throws on first read. Provide an empty default —
// tests opt back into specific values by reassigning before module import.
;(window as unknown as { injectData?: Record<string, string> }).injectData ??=
  {}

export {}

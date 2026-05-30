// Global Vitest setup for the admin app.
//
// Loaded via `test.setupFiles` in `vite.config.mts`. We intentionally keep the
// runtime contract minimal: tests in this repo use `react-dom/client` + raw
// DOM queries against the happy-dom environment (see e.g.
// `src/ui/layout/content-layout.test.tsx`). This file exists as a single
// hook-point for future shared test concerns (matchers, network mocks, etc.)
// without forcing every test to re-import them.
export {}

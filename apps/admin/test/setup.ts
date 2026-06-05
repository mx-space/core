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
// Guard for node-environment tests (e.g. `@vitest-environment node`) where
// `window` is undefined; setup files run for every test regardless of env.
import { createElement, type PropsWithChildren } from 'react'
import { vi } from 'vitest'

if (typeof window !== 'undefined') {
  ;(window as unknown as { injectData?: Record<string, string> }).injectData ??=
    {}
}

// React 19's `act` from `react` (used by raw `react-dom/client` mounts in
// `responsive-data-table.test.tsx` etc.) requires this flag at module load.
;(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// happy-dom does not implement `Element.getAnimations()`, which @base-ui/react
// ScrollAreaViewport calls during its scroll-position effect. Stub it.
if (
  typeof Element !== 'undefined' &&
  !(Element.prototype as { getAnimations?: () => unknown[] }).getAnimations
) {
  ;(Element.prototype as { getAnimations: () => unknown[] }).getAnimations =
    () => []
}

// Most UI tests mount components with raw `react-dom/client` and skip the
// app providers. Replace `~/i18n` with a stub so `useI18n()` works outside an
// `I18nProvider`. Translation lookups use the real zh-CN message table so
// query selectors that match Chinese aria-labels still work.
// Individual tests can `vi.unmock('~/i18n')` to opt back in.
vi.mock('~/i18n', async () => {
  const { messages, DEFAULT_LOCALE, SUPPORTED_LOCALES } =
    await vi.importActual<typeof import('~/i18n/resources')>('~/i18n/resources')

  const identityFormatter = (value: unknown) =>
    value == null ? '' : String(value)

  const translate = (key: string, values?: Record<string, unknown>): string => {
    const table = messages[DEFAULT_LOCALE] as Record<string, string>
    const template = table[key] ?? key
    if (!values) return template
    return template.replaceAll(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    )
  }

  return {
    I18nProvider: ({ children }: PropsWithChildren) =>
      createElement('div', { 'data-testid': 'i18n-provider-stub' }, children),
    useI18n: () => ({
      format: {
        dateTime: identityFormatter,
        number: identityFormatter,
        relativeTime: identityFormatter,
      },
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: translate,
    }),
    isSupportedLocale: (value: string) =>
      (SUPPORTED_LOCALES as readonly string[]).includes(value),
  }
})

// `MarkdownRender` parses input via `marked` inside a `useEffect`, so the
// rendered body is empty on the first sync paint. Tests that assert on body
// text are synchronous — mock to render the raw text inline so they see it.
vi.mock('~/ui/primitives/markdown-render', () => ({
  MarkdownRender: (props: { className?: string; text: string }) =>
    createElement(
      'div',
      { className: props.className, 'data-testid': 'markdown-render-stub' },
      props.text,
    ),
}))

export {}

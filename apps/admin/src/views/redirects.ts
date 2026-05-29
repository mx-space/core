import type { RedirectEntry } from 'virtual:admin-routes'

import { LegacyExtraRedirect, LegacyPageRedirect } from '~/lib/legacy-redirects'

const redirects: RedirectEntry[] = [
  { from: '/posts/view', to: '/posts' },
  { from: '/notes/view', to: '/notes' },
  { from: '/pages/list', to: '/pages' },
  { from: '/files/list', to: '/files' },
  { from: '/maintenance/enrichment', to: '/enrichment' },
  { from: '/maintenance', to: '/maintenance/cron' },
  { from: '/extra-features', to: '/snippets' },
  { from: '/extra-features/snippets', to: '/snippets' },
  { from: '/extra-features/webhooks', to: '/webhooks' },
  { from: '/extra-features/markdown', to: '/markdown' },
  { from: '/extra-features/assets/template', to: '/assets/template' },
  { from: '/extra-features/subscribe', to: '/subscribe' },
  { from: '/ai', to: '/ai/summary' },
  { from: '/page/*', element: LegacyPageRedirect },
  { from: '/extra/*', element: LegacyExtraRedirect },
]

export default redirects

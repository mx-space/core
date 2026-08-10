import { Sparkles } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.ai.title',
  descriptionKey: 'routes.ai.description',
  icon: Sparkles,
  order: 1,
})

// Never rendered: the `/ai` redirect in `views/redirects.ts` is registered
// ahead of the shell routes. This page exists so the sidebar has a parent node
// to hang `/ai/*` under — without it the whole group flattens.
export { AiOverviewRouteView as default } from '~/features/ai/routes/AiOverviewRouteView'

import { Sparkles } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.ai.title',
  descriptionKey: 'routes.ai.description',
  icon: Sparkles,
  order: 1,
})

export { AiRouteView as default } from '~/features/ai/routes/AiRouteView'

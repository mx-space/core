import { AudioLines } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.aiTts.title',
  descriptionKey: 'routes.aiTts.description',
  icon: AudioLines,
  order: 5,
})

export { AiTtsRouteView as default } from '~/features/ai/routes/AiTtsRouteView'

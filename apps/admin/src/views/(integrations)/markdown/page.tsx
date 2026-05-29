import { FileDown } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.markdown.title',
  descriptionKey: 'routes.markdown.description',
  icon: FileDown,
  order: 3,
})

export { MarkdownRouteView as default } from '~/features/markdown/routes/MarkdownRouteView'

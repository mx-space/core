import { BookOpen } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.notes.title',
  descriptionKey: 'routes.notes.description',
  icon: BookOpen,
  order: 2,
})

export { NotesRouteView as default } from '~/features/notes/routes/NotesRouteView'

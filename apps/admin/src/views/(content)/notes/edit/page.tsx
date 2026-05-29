import { Pencil } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.writeNote.title',
  descriptionKey: 'routes.writeNote.description',
  icon: Pencil,
  order: 1,
})

export { NoteWritePage as default } from '~/features/write/routes/WriteRouteViews'

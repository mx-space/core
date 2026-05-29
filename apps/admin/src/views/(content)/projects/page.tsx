import { Folder } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.projects.title',
  descriptionKey: 'routes.projects.description',
  icon: Folder,
  order: 7,
})

export { ProjectsRouteView as default } from '~/features/projects/routes/ProjectsRouteView'

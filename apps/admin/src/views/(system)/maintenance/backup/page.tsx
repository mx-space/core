import { Undo2 } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.backups.title',
  descriptionKey: 'routes.backups.description',
  icon: Undo2,
  order: 2,
})

export { BackupRouteView as default } from '~/features/backup/routes/BackupRouteView'

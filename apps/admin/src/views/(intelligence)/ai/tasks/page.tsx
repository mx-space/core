import { ListTodo } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.aiTasks.title',
  descriptionKey: 'routes.aiTasks.description',
  icon: ListTodo,
  order: 5,
})

export { AiRouteView as default } from '~/features/ai/routes/AiRouteView'

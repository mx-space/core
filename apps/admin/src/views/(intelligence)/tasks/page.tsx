import { ListTodo } from 'lucide-react'

import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.tasks.title',
  descriptionKey: 'routes.tasks.description',
  icon: ListTodo,
  order: 2,
})

export { default } from '~/features/tasks/routes/TasksRouteView'

import { Bot } from 'lucide-react'

import { AdminAgentWorkbenchRoute } from '~/features/agent-core/AdminAgentWorkbenchRoute'
import { defineMetadata } from '~/lib/route-meta'

export const metadata = defineMetadata({
  titleKey: 'routes.aiAgent.title',
  descriptionKey: 'routes.aiAgent.description',
  icon: Bot,
  order: 0,
})

export default AdminAgentWorkbenchRoute

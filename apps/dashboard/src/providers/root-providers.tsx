import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'jotai'
import { LazyMotion, MotionConfig } from 'motion/react'
import type { FC, PropsWithChildren } from 'react'

import { ModalContainer } from '~/components/ui/modal'
import { Toaster } from '~/components/ui/sonner'
import { jotaiStore } from '~/lib/jotai'
import { queryClient } from '~/lib/query-client'
import { Spring } from '~/lib/spring'

import { ContextMenuProvider } from './context-menu-provider'
import { EventProvider } from './event-provider'
import { SettingSync } from './setting-sync'
import { StableRouterProvider } from './stable-router-provider'

const loadFeatures = () =>
  import('../framer-lazy-feature').then((res) => res.default)
export const RootProviders: FC<PropsWithChildren> = ({ children }) => (
  <LazyMotion features={loadFeatures} strict>
    <MotionConfig transition={Spring.presets.smooth}>
      <QueryClientProvider client={queryClient}>
        <Provider store={jotaiStore}>
          <EventProvider />
          <StableRouterProvider />
          <SettingSync />
          <ContextMenuProvider />
          <ModalContainer />
          {children}
        </Provider>
      </QueryClientProvider>
    </MotionConfig>
    <Toaster />
  </LazyMotion>
)

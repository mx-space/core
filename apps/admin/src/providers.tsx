import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import type { PropsWithChildren } from 'react'

import { ModalRoot } from '~/ui/feedback/modal-imperative'
import { ContextMenuHost } from '~/ui/overlay/context-menu'
import { FloatLayerProvider } from '~/ui/overlay/floating-layer'

import { I18nProvider } from './i18n'
import { queryClient } from './query-client'
import { useThemeMode } from './theme'

export function AppProviders(props: PropsWithChildren) {
  const { isDark } = useThemeMode()

  return (
    <QueryClientProvider client={queryClient}>
      <FloatLayerProvider>
        <I18nProvider>
          {props.children}
          <ModalRoot />
          <ContextMenuHost />
        </I18nProvider>
      </FloatLayerProvider>
      <Toaster
        closeButton
        gap={12}
        position="bottom-right"
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{
          classNames: {
            actionButton: 'sonner-action-button',
            cancelButton: 'sonner-cancel-button',
            closeButton: 'sonner-close-button',
            description: 'sonner-description',
            title: 'sonner-title',
            toast: 'sonner-toast',
          },
        }}
      />
    </QueryClientProvider>
  )
}

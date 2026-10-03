import '../index.css'
import '../vendor/rich-editor/core/style'

import { DialogStackProvider } from '@haklex/rich-editor-ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { I18nProvider } from '../i18n'
import { queryClient } from '../query-client'
import { AuthorApp } from './AuthorApp'

Object.assign(window, {
  global: window,
  process: { env: {} },
  module: { exports: {} },
})

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DialogStackProvider>
          <AuthorApp />
        </DialogStackProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)

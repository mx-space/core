import { createContext, useContext } from 'react'

import type { TemplateType, TemplateViewMode } from '../types/templates'

export interface TemplatesRouteContextValue {
  defaultProps: unknown
  dirty: boolean
  loading: boolean
  onChangeProps: (next: unknown) => void
  onChangeSource: (value: string) => void
  onChangeView: (next: TemplateViewMode) => void
  onRefresh: () => void
  onReset: () => void
  onSave: () => void
  onTestSmtp: () => void
  previewError: string
  previewHtml: string
  propsKeys: string[]
  propsValue: unknown
  refreshing: boolean
  resetting: boolean
  saving: boolean
  source: string
  testing: boolean
  type: TemplateType
  viewMode: TemplateViewMode
}

export const TemplatesRouteContext =
  createContext<TemplatesRouteContextValue | null>(null)

export function useTemplatesRouteContext(): TemplatesRouteContextValue {
  const ctx = useContext(TemplatesRouteContext)
  if (!ctx) {
    throw new Error(
      'useTemplatesRouteContext must be used inside <TemplatesRouteContext.Provider>',
    )
  }
  return ctx
}

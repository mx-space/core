import { createContext, useContext } from 'react'

import type { TemplateType } from '../types/templates'

export interface TemplatesRouteContextValue {
  defaultProps: unknown
  dirty: boolean
  loading: boolean
  onChangeProps: (next: unknown) => void
  onChangeSource: (value: string) => void
  onRefresh: () => void
  onReset: () => void
  onSave: () => void
  onSelect: (next: TemplateType) => void
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

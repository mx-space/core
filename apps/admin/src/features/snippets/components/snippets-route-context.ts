import { createContext, useContext } from 'react'

import type { CreateSnippetData } from '~/api/snippets'
import type { SnippetModel } from '~/models/snippet'

export interface SnippetsRouteContextValue {
  deleting: boolean
  emptySnippet: CreateSnippetData
  onBack: () => void
  onDelete: (snippet: SnippetModel) => void
  onInstallDependency: () => void
  onOpenCompiled: (snippet: SnippetModel) => void
  onOpenLogs: (snippet: SnippetModel) => void
  onReset: (snippet: SnippetModel) => void
  onSaved: (snippet: SnippetModel) => void
  resetting: boolean
}

export const SnippetsRouteContext =
  createContext<SnippetsRouteContextValue | null>(null)

export function useSnippetsRouteContext(): SnippetsRouteContextValue {
  const ctx = useContext(SnippetsRouteContext)
  if (!ctx) {
    throw new Error(
      'useSnippetsRouteContext must be used inside <SnippetsRouteContext.Provider>',
    )
  }
  return ctx
}

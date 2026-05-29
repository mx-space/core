import { useMemo } from 'react'
import type { LinkCardRendererProps } from '@haklex/rich-editor/renderers'
import type {
  LinkCardApiAdapter,
  LinkCardFetchContext,
} from '@haklex/rich-renderer-linkcard'
import type { FC } from 'react'

import { LinkCardRenderer } from '@haklex/rich-renderer-linkcard'

import { useEnrichmentFetcher } from '../EnrichmentLinkCardContext'
import { createEnrichmentPlugin } from './enrichment-plugin'

export const LinkCardWithEnrichment: FC<LinkCardRendererProps> = (props) => {
  const fetcher = useEnrichmentFetcher()

  const plugins = useMemo(
    () => (fetcher ? [createEnrichmentPlugin()] : undefined),
    [fetcher],
  )

  const fetchContext = useMemo<LinkCardFetchContext | undefined>(() => {
    if (!fetcher) return undefined
    const adapter: LinkCardApiAdapter = {
      request: async (input) => fetcher(input) as any,
    }
    return { adapters: { enrichment: adapter } }
  }, [fetcher])

  if (!plugins) return <LinkCardRenderer {...props} />

  return (
    <LinkCardRenderer
      {...props}
      plugins={plugins}
      fetchContext={fetchContext}
    />
  )
}

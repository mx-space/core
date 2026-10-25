import '@haklex/rich-diff/style.css'
import '../components/setup-enrichment-linkcard'

import type { RichDiffLayout } from '@haklex/rich-diff'
import { RichDiff } from '@haklex/rich-diff'
import { codeSnippetNodes } from '@haklex/rich-ext-code-snippet/static'
import { embedNodes } from '@haklex/rich-ext-embed/static'
import { ExcalidrawNode } from '@haklex/rich-ext-excalidraw/static'
import { galleryNodes } from '@haklex/rich-ext-gallery/static'
import { nestedDocNodes } from '@haklex/rich-ext-nested-doc/static'
import type { SerializedEditorState } from 'lexical'
import { createRoot } from 'react-dom/client'

import type { EnrichmentFetcher } from '../components/EnrichmentLinkCardContext'
import { EnrichmentFetcherProvider } from '../components/EnrichmentLinkCardContext'
import { enhancedRendererConfig } from '../core'

const extraNodes = [
  ExcalidrawNode,
  ...embedNodes,
  ...galleryNodes,
  ...codeSnippetNodes,
  ...nestedDocNodes,
]

export interface MountRichDiffOptions {
  oldValue: SerializedEditorState
  newValue: SerializedEditorState
  variant?: 'article' | 'comment' | 'note'
  layout?: RichDiffLayout
  collapseUnchanged?: boolean
  renderCollapsed?: (count: number) => string
  className?: string
  theme: 'dark' | 'light'
  fetchEnrichment?: EnrichmentFetcher | null
}

export interface RichDiffHandle {
  update: (opts: MountRichDiffOptions) => void
  unmount: () => void
}

export function mountRichDiff(
  container: HTMLElement,
  initial: MountRichDiffOptions,
): RichDiffHandle {
  const root = createRoot(container)

  const render = (opts: MountRichDiffOptions) => {
    root.render(
      <EnrichmentFetcherProvider value={opts.fetchEnrichment ?? null}>
        <RichDiff
          oldValue={opts.oldValue}
          newValue={opts.newValue}
          variant={opts.variant}
          theme={opts.theme}
          layout={opts.layout}
          collapseUnchanged={opts.collapseUnchanged}
          renderCollapsed={opts.renderCollapsed}
          className={opts.className}
          extraNodes={extraNodes}
          rendererConfig={enhancedRendererConfig}
        />
      </EnrichmentFetcherProvider>,
    )
  }

  render(initial)

  return {
    update(opts) {
      render(opts)
    },
    unmount() {
      root.unmount()
    },
  }
}

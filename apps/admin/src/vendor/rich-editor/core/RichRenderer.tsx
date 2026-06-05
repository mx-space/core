import type { RichRendererProps as BaseRichRendererProps } from '@haklex/rich-compose'
import { RichRenderer as BaseRichRenderer } from '@haklex/rich-compose'
import type { RendererConfig, RichEditorVariant } from '@haklex/rich-editor'
import { NestedContentRendererProvider } from '@haklex/rich-editor'
import { chatNodes } from '@haklex/rich-ext-chat/static'
import { codeSnippetNodes } from '@haklex/rich-ext-code-snippet/static'
import { embedNodes } from '@haklex/rich-ext-embed/static'
import { ExcalidrawNode } from '@haklex/rich-ext-excalidraw/static'
import { galleryNodes } from '@haklex/rich-ext-gallery/static'
import { nestedDocNodes } from '@haklex/rich-ext-nested-doc/static'
import type { Klass, LexicalNode, SerializedEditorState } from 'lexical'
import { useCallback, useMemo } from 'react'

import { MapNode } from '../extensions/map'
import { enhancedRendererConfig } from './configs/enhanced-renderer-config'

const defaultExtraNodes = [
  ExcalidrawNode,
  ...embedNodes,
  ...galleryNodes,
  ...codeSnippetNodes,
  ...chatNodes,
  ...nestedDocNodes,
  MapNode,
]

export interface RichRendererProps extends Omit<
  BaseRichRendererProps,
  'rendererConfig' | 'extraNodes'
> {
  extraNodes?: Array<Klass<LexicalNode>>
  rendererConfig?: Partial<RendererConfig>
}

export function RichRenderer({
  extraNodes,
  rendererConfig,
  ...props
}: RichRendererProps) {
  const mergedNodes = useMemo(
    () =>
      extraNodes ? [...defaultExtraNodes, ...extraNodes] : defaultExtraNodes,
    [extraNodes],
  )

  const mergedConfig = useMemo(
    () =>
      rendererConfig
        ? { ...enhancedRendererConfig, ...rendererConfig }
        : enhancedRendererConfig,
    [rendererConfig],
  )

  const renderNestedContent = useCallback(
    (value: SerializedEditorState, overrideVariant?: RichEditorVariant) => (
      <RichRenderer
        nested
        extraNodes={extraNodes}
        rendererConfig={rendererConfig}
        theme={props.theme}
        value={value}
        variant={overrideVariant ?? props.variant}
      />
    ),
    [extraNodes, props.theme, props.variant, rendererConfig],
  )

  return (
    <NestedContentRendererProvider value={renderNestedContent}>
      <BaseRichRenderer
        {...props}
        extraNodes={mergedNodes}
        rendererConfig={mergedConfig}
      />
    </NestedContentRendererProvider>
  )
}

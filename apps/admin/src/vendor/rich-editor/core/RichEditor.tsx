import type { RichEditorProps as BaseRichEditorProps } from '@haklex/rich-editor'
import {
  NestedContentRendererProvider,
  RichEditor as BaseRichEditor,
} from '@haklex/rich-editor'
import { chatEditNodes } from '@haklex/rich-ext-chat'
import { codeSnippetEditNodes } from '@haklex/rich-ext-code-snippet'
import { DynamicEditNode, DynamicPlugin } from '@haklex/rich-ext-dynamic'
import { embedEditNodes, EmbedPlugin } from '@haklex/rich-ext-embed'
import {
  ExcalidrawEditNode,
  ExcalidrawPlugin,
} from '@haklex/rich-ext-excalidraw'
import { galleryEditNodes } from '@haklex/rich-ext-gallery'
import { BlockHandlePlugin } from '@haklex/rich-plugin-block-handle'
import { FloatingToolbarPlugin } from '@haklex/rich-plugin-floating-toolbar'
import { FloatingLinkEditorPlugin } from '@haklex/rich-plugin-link-edit'
import { LiteXmlPastePlugin } from '@haklex/rich-plugin-litexml-paste'
import type { MentionPlatformDef } from '@haklex/rich-plugin-mention'
import { MentionMenuPlugin } from '@haklex/rich-plugin-mention'
import { SlashMenuPlugin } from '@haklex/rich-plugin-slash-menu'
import {
  TableCellResizerPlugin,
  TableRowColumnHandlesPlugin,
} from '@haklex/rich-plugin-table'
import { katexEditNodes } from '@haklex/rich-renderer-katex'
import {
  ConvertToLinkCardAction,
  linkCardEditNodes,
  PasteLinkCardPlugin,
} from '@haklex/rich-renderer-linkcard'
import type { Klass, LexicalNode, SerializedEditorState } from 'lexical'
import type { ReactNode } from 'react'
import { useCallback, useMemo } from 'react'

import { AfilmoryNode, AfilmoryPlugin } from '../extensions/afilmory'
import { MapNode, MapPlugin } from '../extensions/map'
import { StockNode, StockPlugin } from '../extensions/stock'
import type { TrackUpload } from '../types'
import { enhancedEditRendererConfig } from './configs/enhanced-edit-renderer-config'
import { RichRenderer } from './RichRenderer'

const defaultExtraNodes = [
  DynamicEditNode,
  ExcalidrawEditNode,
  ...embedEditNodes,
  ...linkCardEditNodes,
  ...katexEditNodes,
  ...galleryEditNodes,
  ...codeSnippetEditNodes,
  ...chatEditNodes,
  AfilmoryNode,
  MapNode,
  StockNode,
]

export interface RichEditorProps extends Omit<
  BaseRichEditorProps,
  'rendererConfig' | 'extraNodes' | 'actions'
> {
  actions?: ReactNode
  extraMentionPlatforms?: MentionPlatformDef[]
  extraNodes?: Array<Klass<LexicalNode>>
  /** Extra controls rendered in the floating selection toolbar (e.g. Ask AI). */
  floatingToolbarActions?: ReactNode
  selfHostnames?: string[]
  /** Strategy for uploading dropped/pasted GPX tracks. Returns the public URL. */
  trackUpload?: TrackUpload
}

export function RichEditor({
  extraNodes,
  actions,
  floatingToolbarActions,
  children,
  selfHostnames,
  extraMentionPlatforms,
  trackUpload,
  variant = 'article',
  theme = 'light',
  ...props
}: RichEditorProps) {
  const mergedNodes = useMemo(
    () =>
      extraNodes ? [...defaultExtraNodes, ...extraNodes] : defaultExtraNodes,
    [extraNodes],
  )

  const renderNestedContent = useCallback(
    (value: SerializedEditorState, overrideVariant?: typeof variant) => (
      <RichRenderer
        theme={theme}
        value={value}
        variant={overrideVariant ?? variant}
      />
    ),
    [theme, variant],
  )

  const renderLinkExtraActions = useCallback(
    ({
      url,
      linkKey,
      actionButtonClassName,
    }: {
      url: string
      linkKey: string
      actionButtonClassName: string
    }) => (
      <ConvertToLinkCardAction
        className={actionButtonClassName}
        linkKey={linkKey}
        url={url}
      />
    ),
    [],
  )

  return (
    <NestedContentRendererProvider value={renderNestedContent}>
      <BaseRichEditor
        {...props}
        extraNodes={mergedNodes}
        rendererConfig={enhancedEditRendererConfig}
        theme={theme}
        variant={variant}
        actions={
          <>
            <SlashMenuPlugin />
            <MentionMenuPlugin extraPlatforms={extraMentionPlatforms} />
            {actions}
          </>
        }
      >
        <BlockHandlePlugin />
        <LiteXmlPastePlugin />
        <FloatingToolbarPlugin actions={floatingToolbarActions} />
        <FloatingLinkEditorPlugin renderExtraActions={renderLinkExtraActions} />
        <DynamicPlugin />
        <ExcalidrawPlugin />
        <EmbedPlugin selfHostnames={selfHostnames} />
        <MapPlugin trackUpload={trackUpload} />
        <AfilmoryPlugin />
        <StockPlugin />
        <PasteLinkCardPlugin />
        <TableRowColumnHandlesPlugin />
        <TableCellResizerPlugin />
        {children}
      </BaseRichEditor>
    </NestedContentRendererProvider>
  )
}

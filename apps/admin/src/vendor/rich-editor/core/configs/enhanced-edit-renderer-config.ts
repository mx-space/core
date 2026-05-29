import type { RendererConfig } from '@haklex/rich-editor'

import {
  ALERT_NODE_KEY,
  BANNER_NODE_KEY,
  CODE_BLOCK_NODE_KEY,
  FOOTNOTE_NODE_KEY,
  IMAGE_NODE_KEY,
  MENTION_NODE_KEY,
  MERMAID_NODE_KEY,
  RUBY_NODE_KEY,
  TAG_NODE_KEY,
  VIDEO_NODE_KEY,
} from '@haklex/rich-editor'
import { FootnoteRenderer } from '@haklex/rich-editor/renderers'
import { ChatEditRenderer } from '@haklex/rich-ext-chat/edit'
import { CHAT_NODE_KEY } from '@haklex/rich-ext-chat/node'
import { CodeSnippetEditRenderer } from '@haklex/rich-ext-code-snippet/edit'
import { CODE_SNIPPET_NODE_KEY } from '@haklex/rich-ext-code-snippet/node'
import { GalleryEditRenderer } from '@haklex/rich-ext-gallery'
import { GALLERY_NODE_KEY } from '@haklex/rich-ext-gallery/node'
import { AlertEditRenderer } from '@haklex/rich-renderer-alert'
import { BannerEditRenderer } from '@haklex/rich-renderer-banner'
import { CodeBlockEditRenderer } from '@haklex/rich-renderer-codeblock'
import { ImageEditRenderer } from '@haklex/rich-renderer-image'
import { MentionEditRenderer } from '@haklex/rich-renderer-mention'
import { MermaidEditRenderer } from '@haklex/rich-renderer-mermaid'
import { RubyEditRenderer } from '@haklex/rich-renderer-ruby'
import { VideoEditRenderer } from '@haklex/rich-renderer-video'

import { enhancedRendererConfig } from './enhanced-renderer-config'
import { TagEditRenderer } from './TagEditRenderer'

export const enhancedEditRendererConfig: RendererConfig = {
  ...enhancedRendererConfig,
  [ALERT_NODE_KEY]: AlertEditRenderer,
  [BANNER_NODE_KEY]: BannerEditRenderer,
  [CHAT_NODE_KEY]: ChatEditRenderer,
  [CODE_BLOCK_NODE_KEY]: CodeBlockEditRenderer,
  [CODE_SNIPPET_NODE_KEY]: CodeSnippetEditRenderer,
  [FOOTNOTE_NODE_KEY]: FootnoteRenderer,
  [GALLERY_NODE_KEY]: GalleryEditRenderer,
  [IMAGE_NODE_KEY]: ImageEditRenderer,
  [MENTION_NODE_KEY]: MentionEditRenderer,
  [MERMAID_NODE_KEY]: MermaidEditRenderer,
  [RUBY_NODE_KEY]: RubyEditRenderer,
  [TAG_NODE_KEY]: TagEditRenderer,
  [VIDEO_NODE_KEY]: VideoEditRenderer,
}

import type { RendererConfig } from '@haklex/rich-editor'

import {
  ALERT_NODE_KEY,
  BANNER_NODE_KEY,
  CODE_BLOCK_NODE_KEY,
  IMAGE_NODE_KEY,
  LINK_CARD_NODE_KEY,
  MENTION_NODE_KEY,
  MERMAID_NODE_KEY,
  RUBY_NODE_KEY,
  VIDEO_NODE_KEY,
} from '@haklex/rich-editor'
import { CHAT_NODE_KEY } from '@haklex/rich-ext-chat/node'
import { ChatRenderer } from '@haklex/rich-ext-chat/renderer'
import { CODE_SNIPPET_NODE_KEY } from '@haklex/rich-ext-code-snippet/node'
import { CodeSnippetRenderer } from '@haklex/rich-ext-code-snippet/renderer'
import { GALLERY_NODE_KEY } from '@haklex/rich-ext-gallery/node'
import { GalleryRenderer } from '@haklex/rich-ext-gallery/renderer'
import { AlertRenderer } from '@haklex/rich-renderer-alert/static'
import { BannerRenderer } from '@haklex/rich-renderer-banner/static'
import { CodeBlockRenderer } from '@haklex/rich-renderer-codeblock/static'
import { ImageRenderer } from '@haklex/rich-renderer-image/static'
import { LinkCardRenderer } from '@haklex/rich-renderer-linkcard/static'
import { MentionRenderer } from '@haklex/rich-renderer-mention/static'
import { MermaidRenderer } from '@haklex/rich-renderer-mermaid/static'
import { RubyRenderer } from '@haklex/rich-renderer-ruby/static'
import { VideoRenderer } from '@haklex/rich-renderer-video/static'

export const enhancedRendererConfig: RendererConfig = {
  [ALERT_NODE_KEY]: AlertRenderer,
  [BANNER_NODE_KEY]: BannerRenderer,
  [CHAT_NODE_KEY]: ChatRenderer,
  [CODE_BLOCK_NODE_KEY]: CodeBlockRenderer,
  [CODE_SNIPPET_NODE_KEY]: CodeSnippetRenderer,
  [GALLERY_NODE_KEY]: GalleryRenderer,
  [IMAGE_NODE_KEY]: ImageRenderer,
  [LINK_CARD_NODE_KEY]: LinkCardRenderer,
  [MENTION_NODE_KEY]: MentionRenderer,
  [MERMAID_NODE_KEY]: MermaidRenderer,
  [RUBY_NODE_KEY]: RubyRenderer,
  [VIDEO_NODE_KEY]: VideoRenderer,
}

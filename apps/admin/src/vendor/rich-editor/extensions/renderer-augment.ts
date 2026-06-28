import type {} from '@haklex/rich-editor'
import type { CHAT_NODE_KEY } from '@haklex/rich-ext-chat/node'
import type { CODE_SNIPPET_NODE_KEY } from '@haklex/rich-ext-code-snippet/node'
import type { DYNAMIC_NODE_KEY } from '@haklex/rich-ext-dynamic/static'
import type { GALLERY_NODE_KEY } from '@haklex/rich-ext-gallery/node'
import type { ComponentType } from 'react'

import type {} from './stock/stock-augment'

declare module '@haklex/rich-editor' {
  interface RendererConfig {
    [CHAT_NODE_KEY]?: ComponentType<any>
    [CODE_SNIPPET_NODE_KEY]?: ComponentType<any>
    [DYNAMIC_NODE_KEY]?: ComponentType<any>
    [GALLERY_NODE_KEY]?: ComponentType<any>
  }
}

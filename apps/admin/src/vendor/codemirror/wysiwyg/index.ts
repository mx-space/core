import type { Extension } from '@codemirror/state'

import { blockRangesField } from './block-registry'
import { blockquoteWysiwygExtension } from './blockquote'
import { codeBlockWysiwygExtension } from './codeblock'
import { detailsWysiwygExtension } from './details'
import { dividerWysiwygExtension } from './divider'
import { headingWysiwygExtension } from './heading'
import { inlineWysiwygExtension } from './inline'
import { lineBreakWysiwygExtension } from './line-break'
import { listWysiwygExtension } from './list'
import { mathWysiwygExtension } from './math'
import { wysiwygMeasureExtension } from './measure'

export { isLineInBlock } from './block-registry'
export { isLineInsideCodeBlock } from './codeblock'

export const wysiwygExtensions: Extension[] = [
  blockRangesField,

  ...dividerWysiwygExtension,
  ...headingWysiwygExtension,
  ...listWysiwygExtension,
  ...blockquoteWysiwygExtension,
  ...detailsWysiwygExtension,
  ...mathWysiwygExtension,
  ...inlineWysiwygExtension,
  ...codeBlockWysiwygExtension,
  ...lineBreakWysiwygExtension,
  wysiwygMeasureExtension,
]

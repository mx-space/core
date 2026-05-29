export type {
  AgentLoopHandle,
  EnrichmentAttribute,
  EnrichmentImage,
  EnrichmentResult,
  ImageUpload,
  SaveExcalidrawSnapshot,
} from './types'

export type { EnrichmentFetcher } from './components/EnrichmentLinkCardContext'

export { NestedDocDialogEditor } from './components/NestedDocDialogEditor'
export {
  RichEditorBridge,
  type RichEditorBridgeProps,
} from './components/RichEditorBridge'
export {
  RichEditorWithAgent,
  type RichEditorWithAgentProps,
  type RichEditorWithAgentRef,
} from './components/RichEditorWithAgent'

export {
  buildRichEditorProps,
  type BuildRichEditorPropsInput,
} from './utils/build-rich-editor-props'
export {
  applyAgentOperation,
  applyAgentReviewBatch,
  type AgentOperationApplyResult,
} from './utils/apply-agent-review-batch'

export {
  mountRichEditor,
  type MountRichEditorOptions,
  type RichEditorHandle,
} from './mount/mount-rich-editor'
export {
  mountRichDiff,
  type MountRichDiffOptions,
  type RichDiffHandle,
} from './mount/mount-rich-diff'

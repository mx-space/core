import type { RichEditorVariant } from '@haklex/rich-editor'
import type { Klass, LexicalNode, SerializedEditorState } from 'lexical'

import type { RichEditorProps } from '../core'
import type { ImageUpload, TrackUpload, VideoUpload } from '../types'

export type BuildRichEditorPropsInput = {
  initialValue?: SerializedEditorState
  placeholder?: string
  variant?: RichEditorVariant
  autoFocus?: boolean
  className?: string
  contentClassName?: string
  debounceMs?: number
  selfHostnames?: string[]
  extraNodes?: Array<Klass<LexicalNode>>
  editorStyle?: Record<string, string | number>
  imageUpload?: ImageUpload
  trackUpload?: TrackUpload
  videoUpload?: VideoUpload
}

export function buildRichEditorProps(
  theme: 'dark' | 'light',
  input: BuildRichEditorPropsInput,
): Omit<RichEditorProps, 'onChange' | 'onSubmit' | 'onEditorReady'> {
  const editorProps: Record<string, unknown> = { theme }

  if (input.initialValue !== undefined)
    editorProps.initialValue = input.initialValue
  if (input.placeholder !== undefined)
    editorProps.placeholder = input.placeholder
  if (input.variant !== undefined) editorProps.variant = input.variant
  if (input.autoFocus !== undefined) editorProps.autoFocus = input.autoFocus
  if (input.className !== undefined) editorProps.className = input.className
  if (input.contentClassName !== undefined) {
    editorProps.contentClassName = input.contentClassName
  }
  if (input.debounceMs !== undefined) editorProps.debounceMs = input.debounceMs
  if (input.selfHostnames !== undefined) {
    editorProps.selfHostnames = input.selfHostnames
  }
  if (input.extraNodes !== undefined) editorProps.extraNodes = input.extraNodes
  if (input.editorStyle !== undefined) editorProps.style = input.editorStyle
  if (input.imageUpload !== undefined)
    editorProps.imageUpload = input.imageUpload
  if (input.trackUpload !== undefined)
    editorProps.trackUpload = input.trackUpload
  if (input.videoUpload !== undefined)
    editorProps.videoUpload = input.videoUpload

  return editorProps as Omit<
    RichEditorProps,
    'onChange' | 'onSubmit' | 'onEditorReady'
  >
}

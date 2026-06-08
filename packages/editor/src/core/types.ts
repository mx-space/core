export interface SerializedMxEditorState {
  root: {
    children: readonly unknown[]
    type: 'root'
    version?: number
    direction?: string | null
    format?: string
    indent?: number
  }
}

export interface MxBlockProjection<T = unknown> {
  type: string
  toMarkdown: (node: T) => string
}

export class EditorProjectionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'EditorProjectionError'
    this.cause = options?.cause
  }
}

export class UnknownEditorNodeError extends EditorProjectionError {
  constructor(type: string) {
    super(`Unknown editor node type: ${type}`)
    this.name = 'UnknownEditorNodeError'
  }
}

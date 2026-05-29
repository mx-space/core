import type { SerializedEditorState } from 'lexical'

export function parseSerializedDraftContent(
  content: string,
): SerializedEditorState | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && 'root' in parsed) {
      return parsed as SerializedEditorState
    }
  } catch {
    return null
  }

  return null
}

export function getCurrentColorScheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

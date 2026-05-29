export const EditorStorageKeys = {
  editor: 'editor-pref',
  general: 'editor-general',
} as const

export enum Editor {
  codemirror = 'codemirror',

  plain = 'plain',
}

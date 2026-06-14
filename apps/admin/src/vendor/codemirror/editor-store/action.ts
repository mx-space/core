import type { EditorView } from '@codemirror/view'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import { prepareImageFileForUpload } from '~/lib/image-upload-privacy'
import type { StoreSetter } from '~/store/types'

import {
  addPendingUpload,
  removePendingUpload,
  setPendingUploadError,
} from '../upload-store'
import type { EditorStore } from './store'

type Setter = StoreSetter<EditorStore>

let uploadIdCounter = 0
const generateUploadId = (): string =>
  `__upload_${Date.now()}_${++uploadIdCounter}__`

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export class EditorStoreActionImpl {
  readonly #get: () => EditorStore
  readonly #set: Setter

  constructor(set: Setter, get: () => EditorStore, _api?: unknown) {
    void _api
    this.#set = set
    this.#get = get
  }

  setEditorView = (view: EditorView | undefined): void => {
    if (this.#get().editorView === view) return
    this.#set({ editorView: view }, false, 'editor/setEditorView')
  }

  setEditorValue = (value: string): void => {
    const view = this.#get().editorView
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }

  focusEditor = (): void => {
    this.#get().editorView?.focus()
  }

  uploadImageFile = async (file: File): Promise<void> => {
    const view = this.#get().editorView
    if (!view) return

    const preparedFile = await prepareImageFileForUpload(file)
    if (!preparedFile) return

    const uploadId = generateUploadId()
    const placeholder = `![上传中...](${uploadId})`

    try {
      const base64 = await readFileAsBase64(preparedFile)
      addPendingUpload(uploadId, base64, preparedFile.name)
    } catch {
      /* preview unavailable */
    }

    const { from: cursorPos } = view.state.selection.main
    const currentLine = view.state.doc.lineAt(cursorPos)
    const isLineEmpty = currentLine.text.trim() === ''

    const insertPos = isLineEmpty ? cursorPos : currentLine.to
    const prefix = isLineEmpty ? '' : '\n\n'
    const insertText = `${prefix}${placeholder}`

    view.dispatch({
      changes: { from: insertPos, insert: insertText },
      selection: { anchor: insertPos + insertText.length },
    })

    try {
      const result = await uploadFile(preparedFile, 'image')

      const currentDoc = view.state.doc.toString()
      const placeholderIndex = currentDoc.indexOf(placeholder)

      if (placeholderIndex !== -1) {
        const imageMarkdown = `![](${result.url})`
        view.dispatch({
          changes: {
            from: placeholderIndex,
            to: placeholderIndex + placeholder.length,
            insert: imageMarkdown,
          },
        })
      }
      removePendingUpload(uploadId)
    } catch {
      toast.error('图片上传失败')
      setPendingUploadError(uploadId)

      const currentDoc = view.state.doc.toString()
      const placeholderIndex = currentDoc.indexOf(placeholder)
      if (placeholderIndex !== -1) {
        const placeholderLine = view.state.doc.lineAt(placeholderIndex)
        const isOnlyPlaceholder = placeholderLine.text.trim() === placeholder
        view.dispatch({
          changes: {
            from: isOnlyPlaceholder ? placeholderLine.from : placeholderIndex,
            to: isOnlyPlaceholder
              ? Math.min(placeholderLine.to + 1, view.state.doc.length)
              : placeholderIndex + placeholder.length,
            insert: '',
          },
        })
      }
      removePendingUpload(uploadId)
    }
  }
}

export const createEditorStoreSlice = (
  set: Setter,
  get: () => EditorStore,
  api: unknown,
) => new EditorStoreActionImpl(set, get, api)

export type EditorStoreAction = Pick<
  EditorStoreActionImpl,
  keyof EditorStoreActionImpl
>

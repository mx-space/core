import { uploadFile } from '~/api/files'
import {
  createEmbedMount,
  type EmbedMountOptions,
  type EmbedUpload,
} from '~/vendor/rich-editor/utils/document-bash/embed-mount'
import { remeasureScene } from '~/vendor/rich-editor/utils/document-bash/excalidraw-remeasure'
import { isOwnStorageUrl } from '~/vendor/rich-editor/utils/own-storage-hosts'

const FETCH_TIMEOUT_MS = 15_000
const MAX_TEXT_BYTES = 5 * 1024 * 1024

const UPLOAD_FORMAT = {
  excalidraw: { ext: 'json', type: 'application/json' },
  dynamic: { ext: 'js', type: 'text/javascript' },
} as const

function uploadName(file: EmbedUpload) {
  const base = file.path.slice(file.path.lastIndexOf('/') + 1)
  const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base
  return `${stem}.${UPLOAD_FORMAT[file.kind].ext}`
}

export function createWriteEmbedMount(deps: {
  readBlock: (blockId: string) => Record<string, unknown> | null
  getDraftId: () => string | undefined
  getOwnHosts: () => readonly string[]
  apiUrl: string
  canUpload?: () => boolean
  fetchImpl?: typeof fetch
  uploadImpl?: typeof uploadFile
  remeasure?: (next: string, previous: string | null) => Promise<string>
  dynamicMeta?: EmbedMountOptions['dynamicMeta']
}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const upload = deps.uploadImpl ?? uploadFile

  return createEmbedMount({
    isOwnUrl: (url) => isOwnStorageUrl(url, deps.getOwnHosts()),
    resolveUrl: (ref) =>
      ref.startsWith('ref:')
        ? `${deps.apiUrl.replace(/\/$/, '')}/objects/${ref.slice(4)}`
        : ref,
    fetchText: async (url) => {
      const response = await fetchImpl(url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const text = await response.text()
      if (text.length > MAX_TEXT_BYTES) throw new Error('File is too large')
      return text
    },
    applyDelta: async (base, delta) => {
      const { patch } = await import('jsondiffpatch')
      return patch(structuredClone(base), delta as never)
    },
    upload: async (file) => {
      const format = UPLOAD_FORMAT[file.kind]
      const result = await upload(
        new File([file.content], uploadName(file), { type: format.type }),
        'file',
        {
          immutable: true,
          assetKey: file.assetKey,
          draftId: deps.getDraftId(),
          parentUrl: file.parentUrl,
        },
      )
      return result.url
    },
    transformScene:
      deps.remeasure ?? ((next, previous) => remeasureScene(next, previous)),
    canUpload: deps.canUpload ?? (() => true),
    dynamicMeta: deps.dynamicMeta,
    getCurrentRef: (blockId) => {
      const block = deps.readBlock(blockId)
      const ref = block?.snapshot ?? block?.url
      return typeof ref === 'string' ? ref : null
    },
    createAssetKey: () => crypto.randomUUID(),
  })
}

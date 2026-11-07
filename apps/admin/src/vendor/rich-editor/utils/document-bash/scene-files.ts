const PLACEHOLDER = 'omitted:'

type SceneFile = Record<string, unknown> & { dataURL?: unknown }

const filesOf = (data: unknown) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const files = (data as { files?: unknown }).files
  return files && typeof files === 'object' && !Array.isArray(files)
    ? (files as Record<string, SceneFile>)
    : null
}

export function hideSceneFiles(data: unknown, store: Map<string, string>) {
  const files = filesOf(data)
  if (!files) return data
  const hidden = Object.entries(files).map(([id, file]) => {
    if (typeof file?.dataURL !== 'string' || !file.dataURL.startsWith('data:'))
      return [id, file]
    store.set(id, file.dataURL)
    return [id, { ...file, dataURL: `${PLACEHOLDER}${id}` }]
  })
  return { ...(data as object), files: Object.fromEntries(hidden) }
}

export function hideSceneFilesInText(text: string, store: Map<string, string>) {
  const data = JSON.parse(text)
  const files = filesOf(data)
  if (!files || !Object.keys(files).length) return text
  return JSON.stringify(hideSceneFiles(data, store), null, 2)
}

export function restoreSceneFiles(
  text: string,
  store: Map<string, string>,
  path: string,
) {
  const data = JSON.parse(text)
  const files = filesOf(data)
  if (!files) return text
  let restored = false
  for (const [id, file] of Object.entries(files)) {
    if (typeof file?.dataURL !== 'string') continue
    if (!file.dataURL.startsWith(PLACEHOLDER)) continue
    const key = file.dataURL.slice(PLACEHOLDER.length)
    const dataURL = store.get(key)
    if (!dataURL)
      throw new Error(
        `${path}: files.${id}.dataURL points at ${file.dataURL}, which this workspace does not hold; keep the dataURL values as they were.`,
      )
    file.dataURL = dataURL
    restored = true
  }
  return restored ? JSON.stringify(data) : text
}

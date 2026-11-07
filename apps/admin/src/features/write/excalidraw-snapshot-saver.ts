import { uploadFile } from '~/api/files'

export function createExcalidrawSnapshotSaver(
  getDraftId: () => string | undefined,
  upload: typeof uploadFile = uploadFile,
) {
  return async (snapshot: object, existingRef?: string) => {
    const name = existingRef
      ? `${existingRef.replaceAll(/[^\w.-]/g, '-')}.json`
      : `excalidraw-${crypto.randomUUID()}.json`
    const file = new File([JSON.stringify(snapshot)], name, {
      type: 'application/json',
    })
    const result = await upload(file, 'file', {
      assetKey: crypto.randomUUID(),
      draftId: getDraftId(),
      parentUrl:
        existingRef && /^https?:\/\//.test(existingRef)
          ? existingRef
          : undefined,
    })
    return result.url
  }
}

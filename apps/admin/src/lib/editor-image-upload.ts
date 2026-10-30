import { uploadFile } from '~/api/files'

export async function uploadEditorImage(
  file: File,
  options?: { keepOriginal?: boolean },
) {
  const result = await uploadFile(file, 'image', {
    raw: options?.keepOriginal,
  })
  return { src: result.url }
}

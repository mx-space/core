const IMAGE_EXT = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jfif',
  'jpe',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
])

export function isImageMime(mime: null | string | undefined): boolean {
  if (!mime) return false
  return mime.startsWith('image/')
}

export function isImageByName(name: null | string | undefined): boolean {
  if (!name) return false
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  const ext = name.slice(dot + 1).toLowerCase()
  return IMAGE_EXT.has(ext)
}

export function mimeFromName(name: string): string | undefined {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return undefined
  const ext = name.slice(dot + 1).toLowerCase()
  switch (ext) {
    case 'apng':
    case 'png':
      return 'image/png'
    case 'avif':
      return 'image/avif'
    case 'bmp':
      return 'image/bmp'
    case 'gif':
      return 'image/gif'
    case 'heic':
      return 'image/heic'
    case 'heif':
      return 'image/heif'
    case 'ico':
      return 'image/x-icon'
    case 'jfif':
    case 'jpe':
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg'
    case 'svg':
      return 'image/svg+xml'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    case 'webp':
      return 'image/webp'
    default:
      return undefined
  }
}

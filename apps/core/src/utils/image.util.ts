import path from 'node:path'

export type ImageTypeDetectionResult = { mime: string; ext: string } | null

export type ImageValidationResult =
  | ({ ok: true } & Required<{ mime: string; ext: string }>)
  | { ok: false; reason: string }

export const detectImageType = (buffer: Buffer): ImageTypeDetectionResult => {
  if (buffer.length < 12) return null

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' }
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' }
  }

  // GIF
  if (
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x39 || buffer[4] === 0x37) && // 9 or 7
    buffer[5] === 0x61 // a
  ) {
    return { mime: 'image/gif', ext: '.gif' }
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { mime: 'image/webp', ext: '.webp' }
  }

  // ICO: 00 00 01 00
  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return { mime: 'image/x-icon', ext: '.ico' }
  }

  return null
}

export function validateImageBuffer({
  originUrl,
  buffer,
  allowedMimeTypes,
  allowedExtensions,
}: {
  originUrl?: string
  buffer: Buffer
  contentType?: string
  allowedMimeTypes?: Set<string>
  allowedExtensions?: Set<string>
}): ImageValidationResult {
  const detected = detectImageType(buffer)
  if (!detected) {
    return { ok: false, reason: '不支持的头像图片格式' }
  }

  const { mime, ext } = detected

  if (allowedMimeTypes && !allowedMimeTypes.has(mime)) {
    return { ok: false, reason: '头像仅支持上传常见图片格式' }
  }

  if (allowedExtensions && !allowedExtensions.has(ext)) {
    return { ok: false, reason: '头像仅支持上传常见图片格式' }
  }

  if (originUrl) {
    try {
      const urlExt = path.extname(new URL(originUrl).pathname).toLowerCase()

      if (urlExt && allowedExtensions && !allowedExtensions.has(urlExt)) {
        return { ok: false, reason: '头像文件后缀不被支持' }
      }

      if (urlExt && urlExt !== ext) {
        return { ok: false, reason: '头像文件后缀与实际文件类型不一致' }
      }
    } catch {
      return { ok: false, reason: '头像地址无法解析' }
    }
  }

  return {
    ok: true,
    mime,
    ext,
  }
}

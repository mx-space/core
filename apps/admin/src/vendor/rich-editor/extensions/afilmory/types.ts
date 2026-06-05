export interface AfilmoryManifestPhotoExif {
  Aperture?: number
  DateTimeOriginal?: string
  ExposureTime?: string | number
  FNumber?: number
  FocalLength?: string
  FocalLengthIn35mmFormat?: string
  GPSLatitude?: number
  GPSLongitude?: number
  ISO?: number
  LensMake?: string
  LensModel?: string
  Make?: string
  Model?: string
  Orientation?: number
  ShutterSpeed?: string
  Rating?: number
}

export interface AfilmoryManifestPhoto {
  aspectRatio?: number
  dateTaken?: string
  description?: string
  exif?: AfilmoryManifestPhotoExif
  height: number
  id: string
  isHDR?: boolean
  originalUrl: string
  tags?: string[]
  thumbHash?: string
  thumbnailUrl: string
  title?: string
  width: number
}

export interface AfilmoryManifest {
  data: AfilmoryManifestPhoto[]
  version: string
}

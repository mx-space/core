export enum FileTypeEnum {
  icon = 'icon',
  file = 'file',
  avatar = 'avatar',
  image = 'image',
  video = 'video',
}
export type FileType = keyof typeof FileTypeEnum

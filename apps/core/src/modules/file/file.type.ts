export enum FileTypeEnum {
  icon = 'icon',
  file = 'file',
  avatar = 'avatar',
  image = 'image',
  video = 'video',
  audio = 'audio',
}
export type FileType = keyof typeof FileTypeEnum

export enum FileTypeEnum {
  icon = 'icon',
  file = 'file',
  avatar = 'avatar',
  image = 'image',
}
export type FileType = keyof typeof FileTypeEnum

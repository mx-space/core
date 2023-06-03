export enum FileTypeEnum {
  icon = 'icon',
  photo = 'photo',
  file = 'file',
  avatar = 'avatar',
}
export type FileType = keyof typeof FileTypeEnum

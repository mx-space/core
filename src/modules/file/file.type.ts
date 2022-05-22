export enum FileTypeEnum {
  icon = 'icon',
  photo = 'photo',
  file = 'file',
}
export type FileType = keyof typeof FileTypeEnum

import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator'
import { FileType, FileTypeEnum } from './file.type'

export class FileQueryDto {
  @IsEnum(FileTypeEnum)
  type: FileType
  @IsString()
  name: string
}

export class FileDeleteQueryDto {
  @IsOptional()
  @IsIn(['local', 's3'])
  storage?: 'local' | 's3'

  @IsOptional()
  @IsString()
  url?: string
}

export class FileUploadDto {
  @IsEnum(FileTypeEnum)
  @IsOptional()
  type?: FileType
}

export class RenameFileQueryDto {
  @IsString()
  new_name: string
}

import { IsBoolean, IsOptional } from 'class-validator'

export class UpdateAdminDto {
  @IsBoolean()
  @IsOptional()
  force?: boolean
}

import { IsDefined, IsNotEmpty, IsString } from 'class-validator'

export class OAuthVerifyQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  code: string
}

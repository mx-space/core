import { IsNotEmpty, IsString } from 'class-validator'

export class ServerlessReferenceDto {
  @IsString()
  @IsNotEmpty()
  reference: string

  @IsString()
  @IsNotEmpty()
  name: string
}

import { ArgsType, Field, ID, Int } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator'

@ArgsType()
export class NidOrIdArgsDto {
  @IsInt()
  @Field(() => Int)
  @Min(1)
  @IsOptional()
  @Transform(({ value: v }) => v | 0)
  nid?: number

  @Field(() => ID)
  @IsMongoId()
  @IsOptional()
  id?: string
}

@ArgsType()
export class PasswordArgsDto {
  @IsString()
  @IsOptional()
  password?: string
}

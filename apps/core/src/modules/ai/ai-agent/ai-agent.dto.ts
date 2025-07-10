import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string

  @IsArray()
  @IsOptional()
  context?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export class ChatResponseDto {
  message: string
  timestamp: Date
}

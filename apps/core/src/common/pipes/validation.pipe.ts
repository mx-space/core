import type { ValidationPipeOptions } from '@nestjs/common'
import { Injectable, ValidationPipe } from '@nestjs/common'
import { isDev } from '~/global/env.global'

@Injectable()
export class ExtendedValidationPipe extends ValidationPipe {
  public static readonly options: ValidationPipeOptions = {
    transform: true,
    whitelist: true,
    errorHttpStatusCode: 422,
    forbidUnknownValues: true,
    enableDebugMessages: isDev,
    stopAtFirstError: true,
  }

  public static readonly shared = new ExtendedValidationPipe(
    ExtendedValidationPipe.options,
  )
}

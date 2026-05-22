import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { transformRequestCase } from './case-transform'

@Injectable()
export class RequestCaseNormalizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value
    if (Buffer.isBuffer(value)) return value
    const v = value as { pipe?: unknown; readable?: unknown }
    if (typeof v.pipe === 'function' || v.readable !== undefined) return value

    switch (metadata.type) {
      case 'query':
      case 'param': {
        return transformRequestCase(value, { deep: true })
      }
      case 'body': {
        return transformRequestCase(value, { deep: false })
      }
      default: {
        return value
      }
    }
  }
}

export const requestCaseNormalizationPipeInstance =
  new RequestCaseNormalizationPipe()

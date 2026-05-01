import { UseGuards } from '@nestjs/common'

import { ReaderAuthGuard } from '../guards/reader-auth.guard'

export function ReaderAuth() {
  return UseGuards(ReaderAuthGuard)
}

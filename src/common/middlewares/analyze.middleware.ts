import { NestMiddleware } from '@nestjs/common'
// TODO:
export class AnalyzeMiddleware implements NestMiddleware {
  use(req, res, next) {
    next()
  }
}

import { repl } from '@nestjs/core'

import { register } from './global/index.global'

async function bootstrap() {
  register()
  const { AppModule } = await import('./app.module')
  await repl(AppModule)
}

bootstrap()

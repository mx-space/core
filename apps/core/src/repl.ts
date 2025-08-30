import { repl } from '@nestjs/core'
import { initializeApp } from './global/index.global'

async function bootstrap() {
  initializeApp()
  const { AppModule } = await import('./app.module')
  await repl(AppModule)
}

bootstrap()

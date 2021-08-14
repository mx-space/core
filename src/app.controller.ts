import { Controller, Get } from '@nestjs/common'
import PKG from '../package.json'
import { execSync } from 'child_process'
@Controller()
export class AppController {
  @Get()
  async appInfo(): Promise<IAppInfo> {
    const cmd = `git log --pretty=oneline | head -n 1 | cut -d' ' -f1`
    const hash = execSync(cmd, { encoding: 'utf-8' }).split('\n')[0]
    return {
      // hash: hash.stdout,
      name: PKG.name,
      version: PKG.version,
      hash,
    }
  }

  @Get('/ping')
  ping(): 'pong' {
    return 'pong'
  }
}

interface IAppInfo {
  version: string
  hash: string
  name: string
}

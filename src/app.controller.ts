import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { execSync } from 'child_process'
import PKG from '../package.json'
@Controller()
@ApiTags('Root')
export class AppController {
  @Get()
  async appInfo() {
    const cmd = `git log --pretty=oneline | head -n 1 | cut -d' ' -f1`
    const hash = execSync(cmd, { encoding: 'utf-8' }).split('\n')[0]
    return {
      name: PKG.name,
      author: PKG.author,
      version: PKG.version,
      homepage: PKG.homepage,
      issues: PKG.issues,
      hash,
    }
  }

  @Get('/ping')
  ping(): 'pong' {
    return 'pong'
  }
}

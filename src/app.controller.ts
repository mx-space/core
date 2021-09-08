import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import PKG from '../package.json'
@Controller()
@ApiTags('Root')
export class AppController {
  @Get(['/'])
  async appInfo() {
    let hash = ''
    try {
      await $`git log --pretty=oneline | head -n 1 | cut -d' ' -f1 | cat`
    } catch (e: any) {
      // HACK https://www.codenong.com/19120263/
      if (e.exitCode == 141) {
        hash = e.stdout.trim()
      }
    }

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

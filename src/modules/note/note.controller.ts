import { Controller, Get } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { addConditionToSeeHideContent } from '~/utils/query.util'
import { NoteService } from './note.service'

@ApiName
@Controller({ path: 'notes' })
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get('latest')
  @ApiOperation({ summary: '获取最新发布一篇记录' })
  async getLatestOne(
    @IsMaster() isMaster: boolean,
    @IpLocation() location: IpRecord,
  ) {
    const { latest, next } = await this.noteService.getLatestOne(
      {
        ...addConditionToSeeHideContent(isMaster),
      },
      isMaster ? '+location +coordinates' : '-location -coordinates',
    )

    // this.noteService.shouldAddReadCount(latest, location.ip)
    return { data: latest.toObject(), next: next.toObject() }
  }
}

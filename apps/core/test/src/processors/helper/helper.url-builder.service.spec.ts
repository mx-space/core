import { Test } from '@nestjs/testing'

import { ConfigsService } from '~/modules/configs/configs.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'

describe('UrlBuilderService', () => {
  let service: UrlBuilderService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UrlBuilderService,
        {
          provide: ConfigsService,
          useValue: {},
        },
      ],
    }).compile()

    service = moduleRef.get(UrlBuilderService)
  })

  it('builds note urls by nid even when the note has a slug', () => {
    expect(
      service.build({
        title: 'A slugged note',
        nid: 42,
        slug: 'a-slugged-note',
      } as any),
    ).toBe('/notes/42')
  })
})

import { pickImagesFromMarkdown } from '~/utils/pic.util'
import { sleep } from '~/utils/tool.util'

describe('src/utils/pic.util', () => {
  test('marked ast', async () => {
    const res = pickImagesFromMarkdown(`
![](https://cdn.innei.ren/bed/2021/0813211729.jpeg)

![](https://cdn.innei.ren/bed/2021/0813212633.jpg)
`)
    // FIXME: ReferenceError: You are trying to import a file after the Jest environment has been torn down
    // gifwrap@0.9.2
    await sleep(1)
    expect(res).toEqual([
      'https://cdn.innei.ren/bed/2021/0813211729.jpeg',
      'https://cdn.innei.ren/bed/2021/0813212633.jpg',
    ])
  })
})

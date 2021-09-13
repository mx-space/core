import { pickImagesFromMarkdown } from '~/utils/pic.util'

describe('src/utils/pic.util', () => {
  it('test marked ast', () => {
    const res = pickImagesFromMarkdown(`
![](https://cdn.innei.ren/bed/2021/0813211729.jpeg)

![](https://cdn.innei.ren/bed/2021/0813212633.jpg)
`)
    expect(res).toEqual([
      'https://cdn.innei.ren/bed/2021/0813211729.jpeg',
      'https://cdn.innei.ren/bed/2021/0813212633.jpg',
    ])
  })
})

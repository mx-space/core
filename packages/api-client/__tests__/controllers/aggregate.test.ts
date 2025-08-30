import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { AggregateController } from '~/controllers'
import { TimelineType } from '~/models/aggregate'
import camelcaseKeys from 'camelcase-keys'

describe('test aggregate client', () => {
  const client = mockRequestInstance(AggregateController)
  test('GET /aggregate', async () => {
    const mocked = mockResponse(
      '/aggregate',
      // https://api.innei.ren/v2/aggregate

      {
        user: {
          id: '5ea4fe632507ba128f4c938c',
          introduce: '这是我的小世界呀',
          mail: 'i@innei.ren',
          url: 'https://innei.in',
          name: 'Innei',
          social_ids: {
            bili_id: 26578164,
            netease_id: 84302804,
            github: 'Innei',
          },
          username: 'Innei',
          created: '2020-04-26T03:22:11.784Z',
          modified: '2020-11-13T09:38:49.014Z',
          last_login_time: '2021-11-10T04:47:09.329Z',
          avatar: 'https://cdn.innei.ren/avatar.png',
        },
        seo: {
          title: '静かな森',
          description: '致虚极，守静笃。',
          keywords: ['blog', 'mx-space', 'space', '静かな森'],
        },
        categories: [
          {
            id: '5eb2c62a613a5ab0642f1f7a',
            type: 0,
            count: 34,
            name: '编程',
            slug: 'programming',
            created: '2020-05-06T14:14:02.339Z',
          },
          {
            id: '5eb2c62a613a5ab0642f1f7b',
            type: 0,
            count: 19,
            name: '折腾',
            slug: 'Z-Turn',
            created: '2020-05-06T14:14:02.356Z',
          },
          {
            id: '5eb2c62a613a5ab0642f1f7c',
            type: 0,
            count: 18,
            name: '学习',
            slug: 'learning-process',
            created: '2020-05-06T14:14:02.364Z',
          },
          {
            id: '5eb2c62a613a5ab0642f1f7e',
            type: 0,
            count: 11,
            name: '技术',
            slug: 'technology',
            created: '2020-05-06T14:14:02.375Z',
          },
          {
            id: '5ed09730a0a8f94af569c96c',
            type: 0,
            count: 9,
            slug: 'website',
            name: '站点日志',
            created: '2020-05-29T05:01:36.315Z',
          },
          {
            id: '5ed5be418f3d6b6cb9ab7700',
            type: 0,
            count: 2,
            slug: 'reprinta',
            name: '转载',
            created: '2020-06-02T02:49:37.424Z',
          },
        ],
        page_meta: [
          {
            id: '5e0318319332d06503619337',
            title: '自述',
            slug: 'about',
            order: 1,
          },
          {
            id: '5ea52aafa27a8a01dee55f53',
            order: 1,
            title: '栈',
            slug: 'stack',
          },
          {
            id: '5eb3b6e032c759467b0ad71e',
            order: 0,
            title: '历史',
            slug: 'history',
          },
          {
            id: '5eb54fc06c9cc86c3692349f',
            order: 0,
            title: '留言',
            slug: 'message',
          },
          {
            id: '5f0aaeeaddf2006d12773b12',
            order: 0,
            title: '此站点',
            slug: 'about-site',
          },
          {
            id: '601bce41a0630165aa48b9d0',
            order: 0,
            title: '迭代',
            slug: 'sprint',
          },
        ],
        url: {
          ws_url: 'https://api.innei.ren',
          server_url: 'https://api.innei.ren/v2',
          web_url: 'https://innei.in',
        },
      },
    )
    const data = await client.aggregate.getAggregateData()
    expect(data.$raw.data).toEqual(mocked)
    expect(data.user.name).toEqual(mocked.user.name)
    expect(data.url.webUrl).toEqual(mocked.url.web_url)
  })

  test('GET /aggregate/top', async () => {
    const mocked = mockResponse(
      '/aggregate/top', // 20211114224602
      // https://api.innei.ren/v2/aggregate/top

      {
        notes: [
          {
            id: '618e689174afb47066ab4548',
            title: '结束了，秋招',
            created: '2021-11-12T13:13:53.769Z',
            nid: 104,
          },
          {
            id: '6166c860035bf29e2c32ec40',
            title: '致逝去的青春',
            created: '2021-10-13T11:52:00.327Z',
            nid: 103,
          },
          {
            id: '61586b2f769f07b6852f3bf0',
            title: '论就业压力',
            created: '2021-10-02T14:22:39.934Z',
            nid: 102,
          },
          {
            id: '6149403ac0209bf8c57dcd15',
            title: '关于开源',
            created: '2021-09-21T02:15:22.161Z',
            nid: 101,
          },
          {
            id: '614206d4685e0c58294b1177',
            title: '最近这段日子',
            created: '2021-09-15T14:44:36.061Z',
            nid: 99,
          },
          {
            id: '612db5905c2f6f4d3ba136d2',
            title: '告别',
            created: '2021-08-31T04:52:32.865Z',
            nid: 97,
          },
        ],
        posts: [
          {
            id: '61586f7e769f07b6852f3da0',
            slug: 'host-an-entire-Mix-Space-using-Docker',
            title: '终于可以使用 Docker 托管整个 Mix Space 了',
            created: '2021-10-02T14:41:02.742Z',
            category: {
              name: '站点日志',
              slug: 'website',
            },
          },
          {
            id: '614c539cfdf566c5d93a383f',
            slug: 'docker-node-ncc',
            title: '再遇 Docker，容器化 Node 应用',
            created: '2021-09-23T10:14:52.491Z',
            category: {
              name: '技术',
              slug: 'technology',
            },
          },
          {
            id: '613c91d0326cfffc61923ea2',
            slug: 'github-ci-cd',
            title: '使用 GitHub CI 云构建和自动部署',
            created: '2021-09-11T11:24:00.424Z',
            category: {
              name: '技术',
              slug: 'technology',
            },
          },
          {
            id: '611748895c2f6f4d3ba0d9b3',
            title: 'pageproxy，为 spa 提供初始数据注入',
            slug: 'pageproxy-spa-inject',
            created: '2021-08-14T04:37:29.880Z',
            category: {
              name: '编程',
              slug: 'programming',
            },
          },
          {
            id: '60cffff50ec52e0349cbb29f',
            title: '曲折的 Vue 3 重构后台之路',
            slug: 'mx-space-vue-3',
            created: '2021-06-21T02:56:53.126Z',
            category: {
              name: '编程',
              slug: 'programming',
            },
          },
          {
            id: '60b0a9852e75e2d635406879',
            title: '2021 年了，你不还来试试 TailwindCSS 吗',
            slug: 'tailwind-2021',
            created: '2021-05-28T08:27:49.346Z',
            category: {
              name: '编程',
              slug: 'programming',
            },
          },
        ],
        says: [
          {
            id: '5eb52a73505ad56acfd25c94',
            source: '网络',
            text: '找不到路，就自己走一条出来。',
            author: '魅影陌客',
            created: '2020-05-08T09:46:27.694Z',
          },
          {
            id: '5eb52a94505ad56acfd25c95',
            source: '网络',
            text: '生活中若没有朋友，就像生活中没有阳光一样。',
            author: '能美',
            created: '2020-05-08T09:47:00.436Z',
          },
          {
            id: '5eb52aa7505ad56acfd25c97',
            source: '古城荆棘王',
            text: '没有期盼就不会出现奇迹。',
            author: 'M 崽',
            created: '2020-05-08T09:47:19.285Z',
          },
          {
            id: '5eb9672de2369f53ff02a73c',
            source: '生活',
            text: '别让生活蹂躏了你眉间的温柔。',
            author: '结局',
            created: '2020-05-11T14:54:37.319Z',
          },
          {
            id: '5ebc8c4a5f0af03c7db9d56f',
            source: '佛教禅语',
            text: '忌妒别人，不会给自己增加任何的好处。忌妒别人，也不可能减少别人的成就。',
            author: 'hitokoto',
            created: '2020-05-14T00:09:46.926Z',
          },
          {
            id: '5ec0a02165d4d8495bc2e9f2',
            source: '凪的新生活',
            text: '你还是和原来一样带着面具生活，真是令人作呕。',
            created: '2020-05-17T02:23:29.570Z',
          },
        ],
      },
    )

    const data = await client.aggregate.getTop()
    expect(data.$raw.data).toEqual(mocked)
    expect(data.posts[0].title).toEqual(
      '终于可以使用 Docker 托管整个 Mix Space 了',
    )
    expect(data.notes).toBeDefined()
  })

  it('should filter undefined value in url query, get `/top`', async () => {
    mockResponse('/aggregate/top?size=1', { notes: [{ title: '1 ' }] })
    const data = await client.aggregate.getTop(1)
    expect(data.notes.length).toEqual(1)
  })

  test('GET /timeline', async () => {
    const mocked = mockResponse('/aggregate/timeline', {
      data: {
        posts: [
          {
            id: '5eb2c62a613a5ab0642f1fb8',
            title: '如何配置 zsh',
            slug: 'zshrc',
            created: '2018-09-04T10:34:00.000Z',
            modified: '2020-11-13T21:41:43.774Z',
            category: {
              id: '5eb2c62a613a5ab0642f1f7b',
              type: 0,
              count: 22,
              name: '折腾',
              slug: 'Z-Turn',
              created: '2020-05-06T14:14:02.356Z',
            },
            url: '/posts/Z-Turn/zshrc',
          },
        ],
        notes: [
          {
            id: '5eb35d6f5ae43bbd0c90b8c0',
            title: '回顾快要逝去的寒假',
            created: '2019-02-19T11:59:00.000Z',
            modified: '2020-11-15T09:43:33.199Z',
            nid: 11,
          },
        ],
      },
    })

    const data = await client.aggregate.getTimeline()
    expect(data.$raw.data).toEqual(mocked)
    expect(data.data.posts?.[0].url).toEqual(mocked.data.posts[0].url)
    expect(data.data.notes).toBeDefined()
  })

  test('GET /timeline', async () => {
    const mocked = mockResponse('/aggregate/timeline?type=1', {
      data: {
        notes: [
          {
            id: '5eb35d6f5ae43bbd0c90b8c0',
            title: '回顾快要逝去的寒假',
            created: '2019-02-19T11:59:00.000Z',
            modified: '2020-11-15T09:43:33.199Z',
            nid: 11,
          },
        ],
      },
    })

    const data = await client.aggregate.getTimeline({
      type: TimelineType.Note,
    })
    expect(data.$raw.data).toEqual(mocked)
    expect(data.data.notes?.[0]).toEqual(mocked.data.notes[0])
    expect(data.data.posts).toBeUndefined()
  })

  test('GET /stat', async () => {
    const mocked = mockResponse('/aggregate/stat', {
      all_comments: 464,
      categories: 6,
      comments: 260,
      link_apply: 0,
      links: 43,
      notes: 89,
      pages: 6,
      posts: 93,
      says: 26,
      recently: 19,
      unread_comments: 0,
      online: 0,
      today_max_online: '3',
      today_online_total: '2565',
      call_time: 1054126,
      uv: 67733,
      today_ip_access_count: 138,
    })
    const data = await client.aggregate.getStat()
    expect(data.$raw.data).toEqual(mocked)
    expect(data).toEqual(camelcaseKeys(mocked))
  })
})

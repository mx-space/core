#!/usr/bin/env tsx
/* eslint-disable unicorn/no-immediate-mutation */
/**
 * Bench A/B for translation prompts (OLD vs NEW) using DeepSeek.
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-... tsx apps/core/scripts/bench-translation-prompt.ts
 *   pnpm -C apps/core run bench:translation-prompt
 *
 * Env:
 *   DEEPSEEK_API_KEY   required
 *   DEEPSEEK_MODEL     optional, default 'deepseek-chat'
 *   DEEPSEEK_BASE_URL  optional, default 'https://api.deepseek.com'
 *   BENCH_CASES        optional comma-separated case ids to restrict (e.g. "zh-en-1,en-zh-1")
 *   BENCH_OUT          optional output path (default scripts/.bench-translation-output-<ts>.md)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { config as loadDotenv } from 'dotenv'
import OpenAI from 'openai'

process.argv = [process.argv[0], process.argv[1]]

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

loadDotenv({
  path: [
    join(__dirname, '..', '..', '..', '.env'),
    join(__dirname, '.env'),
  ],
  quiet: true,
})

const { buildTranslationSystemOld } = await import('./bench-translation-baseline')
const { AI_PROMPTS } = await import('../src/modules/ai/ai.prompts')

type Content = {
  title: string
  text: string
  subtitle?: string
  summary?: string
  tags?: string[]
}

type Case = {
  id: string
  targetLang: string
  targetLangName: string
  note: string
  content: Content
}

const REAL_ESSAY_ZH = {
  title: '我的生活被 AI 占满了，那么我还剩什么呢？',
  text: `又过去了快不到一个月的时间。这段时间里面，我的生活一如既往。

好像现在如果我不去谈论 AI，或者说我用 AI 又做了一些什么东西的话，我就没有什么特别能说的内容了。就是那么的枯燥，一切都是围着 AI 在打转。

这段日子我又搞了几个 AI 的工作流。比如用 AI 花了 50 个小时，把我的博客迁移到了 Remix.. 全自动化写博客等等。

其实我已经不想讲太多了，如果你感兴趣的话，可以去翻翻我历史发送的推特，还有写过的文章。

现在我想聊聊我最近的一些状态，或许是情感方面的。

我已经踏入社会四年了，至今也没有谈过一段恋爱。其实我一直想知道，爱情是什么样的。

最令人憧憬的恋爱，应该就是发生在学生时代，但遗憾的是，我不曾有过。我像个傻软一样，总是刷着短视频，看着别人的爱情，然后自己在那傻傻地笑。

其实在之前很长的一段日子里，我都不曾想过类似的话题，可能今年会是有点特别。也许是因为年纪也大了，确实感觉到了孤独。

我是一个非常悲观的人。或许也是因为网上充斥着那种负能量，让我觉得很难有健康的恋爱关系，或者说能够携手走到最后的。

看看当今社会的离婚率，以及越来越多单身的人。再看看身边那些爱情长跑的人，往往到最后也是不欢而散。这让我又感觉到了非常的绝望，感觉现实总是这样，在不经意间给你一击。

很长的一段时间，或者说是现在，每当谈论到这个话题，我总是有着矛盾的心理。

一方面，我渴望拥有这样的关系；而另一方面，我更多的是担心自己能不能承担起这样的责任。随着岁数越来越大，这种恐惧和矛盾也变得越来越严重。

扪心自问一下，我向往的关系是什么样的呢？

看着短视频中那些浪漫的情节，在我这个年龄段，已经是可望而不可及的了。我一直生活在一个小圈子里面，再加上性格和工作的原因，其实没有什么交际圈，也没有什么认识的女性。

我也非常排斥去相亲。相亲总是一件非常现实的东西，大家都是把自己的条件摆在明面上来讲。我感觉这样更多的只是物质上的一些满足，更像是一种谈判，一种买卖，我不喜欢这样。

自由恋爱的话，对我来说更加是天方夜谭了。也许我没有跨出第一步的话，这辈子也就这样了。

其实说出来真的非常丢脸，长这么大，也很少和女生聊过天吧。不管是线上还是线下，都很少有过接触。之前使用微信 CLI 导出了我全部的聊天记录。比较意外的是，聊天最多的一个对象是个女生。总共聊了 1 万多条消息。那个时候，我刚快要毕业，通过了小红书的校招，在校招群里认识了她。然后我们基本上就聊得比较多。

回顾过去的对话，中间也聊过一些情感的话题。甚至当时我还邀请她家里吃饭之类的，现在想想还有点搞笑。但是这件事其实并没有什么后文了，后来我们慢慢就断了联系。

不过啊，那个时候我根本就没有过这种想法，所以也不是为了这个念头而去对待这段关系的。现在想起来，如果当时有想过这个念头的话，或许可以努力一下。但时间已经过去太久了。 其实一方面还是更多的不自信，以及对未来的焦虑。很多事情想想就可怕，永远都不敢迈出第一步。

在今年年初的时候，其实也是通过家里人的牵线，和以前的一个女同学聊过一周左右。但我发现聊天这个东西真的是太累了，尤其是两个都没有什么经验的人，或者说总有一方是回避的。

说是回避，也有可能就是对你没兴趣，所以不想理你太多。而且我是焦虑的一方，事情就会变得非常糟糕。

在更多场景下，作为男方需要主动，发送了消息之后，要绞尽脑汁地想话题发过去，然后便是焦急地等待。

时间一分一秒过去，过了半个小时、一个小时，对方才回复一句。几次过后，就感觉非常心累。我不喜欢这种不对等的关系，最后我把她拉黑了。我不再焦虑了。我不再需要期待能够收到她的回复了。

讨厌这种不对等的付出关系。而在那之后的一段时间后，又发生了一次。

这一次的经历是我主动联系了一个很久没联系的初中女同学。

说起来也比较奇怪，为什么会联想到她呢？因为我以前经常会梦到初中的场景。每当我感到焦虑时，就会梦见初中的班主任，以及各种考试的场面。

感觉还是那段时间的记忆对我影响太深，甚至留下了不少阴影。有的时候梦中的场景会有他。

之所以会有她，是因为在初中的前两个年级里，我跟她做过一段时间的同桌。当时我在班里的成绩算比较好的，她也还行，记得她那个时候好像是学习委员。除此之外，其实就没有什么印象比较深的事了。反正在我印象中，基本上很少有比较印象深刻的事情，也不存在说还发生了什么。

总之就是这样吧，某天我直接给他发了消息。

比较意外的是，其实她刚开始给我的感觉还是比较热情的，当天我们就聊了挺多。后面的那段日子，也是有事没事就去聊聊天。

当然我也不知道这是新鲜感还是什么，反正就是比较愿意聊。一开始也问了一下，中间也问过一些情感方面的问题。

比如说，她说她之前谈过一段恋爱，但后面是什么原因分的没透露，反正就说自己不适合谈恋爱，现在也不想找对象，很抵制去相亲之类的。就这样差不多聊了一周多吧的时间，期间也聊了工作、生活、兴趣爱好之类的话题。

然后我们就线下约出来吃饭。给我的感觉她也是比较爽快的人，直接就答应出来了。而且我是属于那种，如果要约晚饭的话，我就当天下午直接邀约。后面陆陆续续见了几次面。
出来见了五六次，吃了三四顿饭，这中间的过程跨度大概也就不到两个月。

现在慢慢地基本上没有什么可聊的了，再主动去约的话，也不会有什么结果。这仍然是一段非常不对等的关系，你主动付出是得不到什么回应的，不管是情绪价值还是别的什么。`,
}

const CASES: Case[] = [
  {
    id: 'real-essay-zh-en',
    targetLang: 'en',
    targetLangName: 'English',
    note: 'real personal essay — long zh→en, casual register, idiomatic colloquialisms',
    content: REAL_ESSAY_ZH,
  },
  {
    id: 'real-essay-zh-ja',
    targetLang: 'ja',
    targetLangName: 'Japanese',
    note: 'real personal essay — long zh→ja, casual register, danger of Chinese-pattern leakage',
    content: REAL_ESSAY_ZH,
  },
  {
    id: 'zh-en-narrative',
    targetLang: 'en',
    targetLangName: 'English',
    note: 'zh narrative with topic-comment, omitted subjects, 的-chains',
    content: {
      title: '关于离职那天的几件小事',
      text: `那天的天气格外好，阳光透过百叶窗洒在桌面上，我盯着屏幕上那封迟迟未发出的离职信看了很久。

办公室里同事们的笑声此起彼伏，仿佛一切如常。其实早在半年前，我就已经隐隐感到这份工作带给我的疲惫远超出了我能承受的范围。但真正决定离开，是在上周五凌晨三点，又一次为了一个根本无关紧要的需求改到了天亮之后。

我把信发给了老板，然后合上笔记本，去茶水间倒了一杯水。返回工位的路上，遇到了入职时带我熟悉环境的前辈。她笑着问我最近怎么样，我说挺好的，她说那就好。`,
    },
  },
  {
    id: 'zh-en-technical',
    targetLang: 'en',
    targetLangName: 'English',
    note: 'zh tech writeup that easily becomes Chinglish',
    content: {
      title: '关于我们为什么放弃了微服务架构',
      text: `两年前我们做出了一个现在看来有些草率的决定：把原本运行良好的单体应用拆分成了七个微服务。当时的理由听起来很合理——团队规模在扩大，单体的部署变得越来越慢，我们也希望各个业务模块可以独立演进。

但是事情并没有按照预期发展。运维复杂度成倍增长，跨服务的调试变成了一场噩梦，每一次需求变更都可能涉及三到四个服务的协同上线。最让人沮丧的是，那些我们原本希望解耦的业务模块，反而因为微服务边界的存在变得更加耦合了——只不过这种耦合从代码层面转移到了网络调用层面。

经过半年的反复讨论，我们决定回归单体。这次不是因为我们不懂微服务，而是因为我们终于理解了它真正适用的场景。`,
      tags: ['架构', '微服务', '复盘'],
    },
  },
  {
    id: 'en-zh-academic',
    targetLang: 'zh',
    targetLangName: 'Chinese',
    note: 'en academic prose with nested relative clauses',
    content: {
      title: 'The Paradox of Choice in Modern Software Design',
      text: `It has become something of an article of faith among software architects that giving users more options necessarily produces better products. Yet a growing body of research, much of which builds on Schwartz's seminal work in consumer psychology, suggests that this assumption may be fundamentally mistaken.

When users are presented with too many configurable parameters, the cognitive load required to make even simple decisions grows non-linearly with the number of available choices. This is particularly evident in developer tools, where the proliferation of flags, options, and configuration files has, somewhat paradoxically, made many systems harder to use rather than more flexible.

The most successful frameworks of the past decade — those that have achieved both widespread adoption and genuine user satisfaction — tend to share a common characteristic: they make strong opinions about defaults while keeping escape hatches available for the minority of users who genuinely need them.`,
    },
  },
  {
    id: 'en-zh-casual',
    targetLang: 'zh',
    targetLangName: 'Chinese',
    note: 'casual en blog with idioms that resist literal translation',
    content: {
      title: 'Why I Finally Gave Up on Cron Jobs',
      text: `I spent the better part of a decade swearing by cron. It was simple, it was reliable, and — most importantly — it stayed out of my way. When something needed to run every Tuesday at 3am, I'd add a line to a crontab and that would be the end of it.

The trouble started, as it often does, when the system grew. One cron job became ten, ten became fifty, and somewhere along the way I lost track of what was running where. A coworker once asked me, in the middle of a postmortem, why a job had failed silently for three weeks. I had no good answer. The honest answer was: because nobody was watching.

Eventually I bit the bullet and migrated everything to a proper job scheduler with logging, retries, and dependency tracking. It's not as elegant as cron — but at least when things break, I find out before the customer does.`,
    },
  },
  {
    id: 'zh-ja-essay',
    targetLang: 'ja',
    targetLangName: 'Japanese',
    note: 'zh casual essay prone to Chinese-pattern leakage in ja',
    content: {
      title: '一个人吃火锅的下午',
      text: `周六的下午，我一个人去吃了火锅。

店里人不多，服务员把我安排在了靠窗的位置。锅刚端上来的时候，蒸汽顺着光照过的方向缓缓上升，我突然觉得这场景有点像电影里那种刻意营造的孤独——只不过这一次的孤独是真的，而我也没有觉得有什么不好。

涮着涮着，旁边的一桌四个人开始合唱生日歌。我没回头看，但听得出他们很开心。我也跟着在心里哼了两句，然后继续吃我自己的肉。

走出店门的时候天已经暗了，街上的灯一盏一盏亮起来，我想起小时候妈妈说的，一个人吃饭的人最容易胖。我笑了一下，没回家，去了书店。`,
    },
  },
  {
    id: 'en-ja-technical',
    targetLang: 'ja',
    targetLangName: 'Japanese',
    note: 'en technical text with heavy nominalization + passive',
    content: {
      title: 'A Pragmatic Guide to Database Migrations in Production',
      text: `Database migrations are one of those topics where the gap between textbook advice and production reality is unusually wide. The standard recommendation — "run your migrations during a maintenance window" — assumes a luxury most modern teams no longer have: meaningful downtime.

In practice, every schema change in a high-availability system must be designed under the assumption that old and new versions of the application will coexist for some period, often several minutes, sometimes hours. This single constraint reshapes how migrations must be written. Columns cannot simply be dropped; they must first be ignored, then deprecated, then removed. Constraints cannot be added in one step; they must be backfilled, validated, and only then enforced.

The discipline that emerges from working under these constraints is often called expand-contract, and it is one of the few patterns in software engineering that genuinely deserves the label "non-optional".`,
      tags: ['database', 'migration', 'devops'],
    },
  },
  {
    id: 'zh-en-structure',
    targetLang: 'en',
    targetLangName: 'English',
    note: 'structure preservation sanity check',
    content: {
      title: '关于缓存失效的三种策略',
      text: `# 缓存失效策略

在分布式系统中，常见的缓存失效策略有以下几种：

1. **TTL 过期**：最简单也最常用
2. **主动失效**：写操作时立即清理
3. **版本号机制**：每次写入递增版本号

下面是一段示例代码：

\`\`\`ts
async function invalidate(key: string) {
  await redis.del(\`cache:\${key}\`)
}
\`\`\`

更详细的讨论可见 [这篇文章](https://example.com/cache)。`,
    },
  },
]

function tokensEstimate(s: string): number {
  return Math.ceil(s.length / 3.5)
}

function pickCases(): Case[] {
  const filter = process.env.BENCH_CASES?.trim()
  if (!filter) return CASES
  const ids = new Set(filter.split(',').map((x) => x.trim()).filter(Boolean))
  return CASES.filter((c) => ids.has(c.id))
}

async function callDeepSeek(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; usage?: OpenAI.Completions.CompletionUsage }> {
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  })
  return {
    text: res.choices[0]?.message?.content ?? '',
    usage: res.usage ?? undefined,
  }
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\n?```\s*$/, '')
}

function tryParse(s: string):
  | { ok: true; value: any }
  | { ok: false; error: string; raw: string } {
  const cleaned = stripFences(s.trim())
  try {
    return { ok: true, value: JSON.parse(cleaned) }
  } catch (e) {
    return { ok: false, error: (e as Error).message, raw: cleaned }
  }
}

function fence(content: string, lang = 'markdown'): string {
  const safe = content.includes('```') ? content.replaceAll('```', '​```') : content
  return `\`\`\`${lang}\n${safe}\n\`\`\``
}

function renderResult(label: string, parsed: ReturnType<typeof tryParse>): string {
  if (!parsed.ok) {
    return `**${label}** — JSON parse failed: ${parsed.error}\n\n${fence(parsed.raw, 'text')}\n`
  }
  const { value } = parsed
  const parts: string[] = [`**${label}**`, '']
  parts.push(`- sourceLang: \`${value.sourceLang ?? '?'}\``)
  parts.push(`- title: ${value.title ?? ''}`)
  if (value.subtitle) parts.push(`- subtitle: ${value.subtitle}`)
  if (value.summary) parts.push(`- summary: ${value.summary}`)
  if (Array.isArray(value.tags)) parts.push(`- tags: ${value.tags.join(', ')}`)
  parts.push('')
  parts.push(fence(String(value.text ?? '')))
  return parts.join('\n')
}

async function main() {
  const usingDeepSeekDirect = !!process.env.DEEPSEEK_API_KEY
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.MX_AI_API_KEY
  if (!apiKey) {
    console.error(
      'DEEPSEEK_API_KEY (or MX_AI_API_KEY) is required. Set it in env or .env',
    )
    process.exit(1)
  }

  const baseURL =
    process.env.DEEPSEEK_BASE_URL ||
    (usingDeepSeekDirect
      ? 'https://api.deepseek.com'
      : process.env.MX_AI_ENDPOINT || 'https://api.deepseek.com')
  const model =
    process.env.DEEPSEEK_MODEL ||
    (usingDeepSeekDirect
      ? 'deepseek-chat'
      : process.env.MX_AI_MODEL || 'deepseek-chat')
  console.log(`[bench] using model=${model} baseURL=${baseURL}`)
  const client = new OpenAI({ apiKey, baseURL })

  const cases = pickCases()
  if (cases.length === 0) {
    console.error('No cases matched BENCH_CASES filter.')
    process.exit(1)
  }

  const ts = new Date().toISOString().replaceAll(/[.:]/g, '-')
  const outPath = process.env.BENCH_OUT
    ? resolve(process.env.BENCH_OUT)
    : join(__dirname, `.bench-translation-output-${ts}.md`)

  const sections: string[] = [`# Translation Prompt A/B Bench`, '']
  sections.push(`- Model: \`${model}\``)
  sections.push(`- Base URL: \`${baseURL}\``)
  sections.push(`- Cases: ${cases.length}`)
  sections.push(`- Timestamp: ${new Date().toISOString()}`)
  sections.push('')

  for (const c of cases) {
    console.log(`[bench] case=${c.id} target=${c.targetLang}`)

    const newObj = AI_PROMPTS.translation(c.targetLang, c.content)
    const newSystem = newObj.systemPrompt
    const userPrompt = newObj.prompt
    const oldSystem = buildTranslationSystemOld(c.targetLang === 'ja', false)

    const sysOldTokens = tokensEstimate(oldSystem)
    const sysNewTokens = tokensEstimate(newSystem)

    let oldOut: Awaited<ReturnType<typeof callDeepSeek>>
    let newOut: Awaited<ReturnType<typeof callDeepSeek>>
    try {
      ;[oldOut, newOut] = await Promise.all([
        callDeepSeek(client, model, oldSystem, userPrompt),
        callDeepSeek(client, model, newSystem, userPrompt),
      ])
    } catch (e) {
      console.error(`[bench] case=${c.id} failed:`, (e as Error).message)
      sections.push(`## ${c.id} — ${c.targetLangName}`)
      sections.push('')
      sections.push(`> Error: ${(e as Error).message}`)
      sections.push('')
      continue
    }

    const oldParsed = tryParse(oldOut.text)
    const newParsed = tryParse(newOut.text)

    sections.push(`## ${c.id} — target ${c.targetLangName}`)
    sections.push('')
    sections.push(`_${c.note}_`)
    sections.push('')
    sections.push(`System tokens (est.): OLD ${sysOldTokens} / NEW ${sysNewTokens} (Δ ${sysNewTokens - sysOldTokens})`)
    sections.push('')
    sections.push(`### Source`)
    sections.push('')
    sections.push(`- title: ${c.content.title}`)
    if (c.content.subtitle) sections.push(`- subtitle: ${c.content.subtitle}`)
    if (c.content.summary) sections.push(`- summary: ${c.content.summary}`)
    if (c.content.tags?.length) sections.push(`- tags: ${c.content.tags.join(', ')}`)
    sections.push('')
    sections.push(fence(c.content.text))
    sections.push('')
    sections.push(`### OLD prompt output`)
    sections.push('')
    sections.push(renderResult('OLD', oldParsed))
    if (oldOut.usage) {
      sections.push('')
      sections.push(`_usage: prompt=${oldOut.usage.prompt_tokens} completion=${oldOut.usage.completion_tokens}_`)
    }
    sections.push('')
    sections.push(`### NEW prompt output`)
    sections.push('')
    sections.push(renderResult('NEW', newParsed))
    if (newOut.usage) {
      sections.push('')
      sections.push(`_usage: prompt=${newOut.usage.prompt_tokens} completion=${newOut.usage.completion_tokens}_`)
    }
    sections.push('')
    sections.push('---')
    sections.push('')
  }

  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, sections.join('\n'))
  console.log(`[bench] wrote ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

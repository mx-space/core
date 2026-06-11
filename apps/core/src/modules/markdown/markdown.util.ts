import { marked } from 'marked'
import xss, { FilterXSS, getDefaultWhiteList } from 'xss'

marked.use({
  extensions: [
    {
      level: 'inline',
      name: 'spoiler',
      start(src) {
        return src.match(/\|/)?.index ?? -1
      },
      renderer(token) {
        // @ts-ignore
        return `<span class="spoiler" style="filter: invert(25%)">${this.parser.parseInline(
          token.text,
        )}\n</span>`
      },
      tokenizer(src) {
        const rule = /^\|\|(.+?)\|\|(?!\|)/s
        const match = rule.exec(src)
        if (match) {
          return {
            type: 'spoiler',
            raw: match[0],
            // @ts-ignore
            text: this.lexer.inlineTokens(match[1].trim()),
          }
        }
      },
      childTokens: ['text'],
    },
    {
      level: 'inline',
      name: 'katex',
      start(src) {
        return src.match(/\$/)?.index ?? -1
      },
      renderer(token) {
        return `<span class="katex-render">${token.text}</span>`
      },
      tokenizer(src) {
        const rule = /^\$(.+?)\$(?!\$)/s
        const match = rule.exec(src)
        if (match) {
          return {
            type: 'katex',
            raw: match[0],
            // @ts-ignore
            text: match[1].trim(),
          }
        }
      },
    },
    {
      level: 'inline',
      name: 'mention',
      start(src) {
        return src.match(/\(/)?.index ?? -1
      },
      renderer(token) {
        const { groups } = token
        const { prefix, name: username } = groups

        const prefixToUrlMap = {
          GH: 'https://github.com/',
          TW: 'https://twitter.com/',
          TG: 'https://t.me/',
        }
        const urlPrefix = prefixToUrlMap[prefix]
        return `<a target="_blank" class="mention" rel="noreferrer nofollow" href="${urlPrefix}${username}">${username}</a>`
      },
      tokenizer(src) {
        // eslint-disable-next-line unicorn/better-regex -- its autofix (`\]` -> `]`) conflicts with regexp/strict
        const rule = /^(?<prefix>GH|TW|TG)@(?<name>\w+)\s?(?!\[.*?\])/
        const match = rule.exec(src)
        if (match) {
          const { groups } = match
          return {
            type: 'mention',
            raw: match[0],
            groups,
          }
        }
      },
      childTokens: ['text'],
    },
    {
      level: 'block',
      name: 'container',
      start(src) {
        return src.indexOf(':::')
      },
      renderer(token) {
        const { groups, images, paragraph } = token
        const { params, name } = groups

        switch (name) {
          case 'gallery': {
            return `<div class="container">${this.parser.parseInline(
              images,
            )}</div>`
          }
          case 'banner': {
            return `<div class="container ${name} ${params}">${this.parser.parse(
              paragraph,
            )}</div>`
          }
        }
        return ''
      },
      tokenizer(src) {
        const shouldCatchContainerName = [
          'gallery',
          'banner',
          /* 'carousel', */
        ].join('|')
        const match = new RegExp(
          `^\\s*::: *(?<name>${shouldCatchContainerName})(?: *\\{(?<params>[^}\n]*)\\})? *\n(?<content>.+?)\n[^\\S\n]*::: *(?:\n *)+`,
          's',
        ).exec(src)
        if (match) {
          const { groups } = match
          return {
            type: 'container',
            raw: match[0],
            groups,

            images: this.lexer.inlineTokens(groups!.content),
            // @ts-expect-error
            paragraph: this.lexer.blockTokens(groups.content),
          }
        }
      },
      childTokens: ['paragraph', 'image'],
    },
  ],

  renderer: {
    // @ts-ignore
    image(src, title, _alt) {
      if (typeof src !== 'string') {
        return ''
      }

      const alt = _alt?.match(/^[!¡]/) ? _alt.replace(/^[!¡]/, '') : ''
      if (!alt) {
        return `<img src="${xss(src)}"/>`
      }
      return `<figure>
          <img src="${xss(src)}"/>
          <figcaption style="text-align: center; margin: 1em auto;">${xss(
            title || alt,
          )}</figcaption></figure>`
    },

    code(code) {
      const { lang, text } = code
      if (lang == 'mermaid') {
        return `<pre class="mermaid">${text}</pre>`
      } else {
        return `<pre><code class="language-${lang}">${xss(text)}</code></pre>`
      }
    },
  },
})

const withCommonAttrs = (...extra: string[]) => [
  'class',
  'style',
  'id',
  ...extra,
]

// Sanitizer for the full HTML output of the marked pipeline. The renderer can
// emit untrusted user content unescaped (notably the katex extension, which
// inlines `token.text` verbatim into `<span class="katex-render">`), so the
// whole rendered document is filtered before it is templated or served.
// `css: false` keeps the renderer's own constant inline styles (e.g. the
// spoiler `filter: invert(25%)`) intact; no user-controlled value reaches a
// `style` attribute in this pipeline.
const defaultWhiteList = getDefaultWhiteList()
const htmlSanitizer = new FilterXSS({
  css: false,
  whiteList: {
    ...defaultWhiteList,
    a: [...(defaultWhiteList.a ?? []), 'rel', 'class', 'style', 'id'],
    img: [...(defaultWhiteList.img ?? []), 'class', 'style', 'id'],
    span: withCommonAttrs(),
    div: withCommonAttrs(),
    figure: withCommonAttrs(),
    figcaption: withCommonAttrs(),
    pre: withCommonAttrs(),
    code: withCommonAttrs(),
    p: withCommonAttrs(),
    h1: withCommonAttrs(),
    h2: withCommonAttrs(),
    h3: withCommonAttrs(),
    h4: withCommonAttrs(),
    h5: withCommonAttrs(),
    h6: withCommonAttrs(),
    ul: withCommonAttrs(),
    ol: withCommonAttrs(),
    li: withCommonAttrs(),
    blockquote: withCommonAttrs(),
    table: withCommonAttrs(),
    thead: withCommonAttrs(),
    tbody: withCommonAttrs(),
    tr: withCommonAttrs(),
    td: withCommonAttrs('colspan', 'rowspan', 'align'),
    th: withCommonAttrs('colspan', 'rowspan', 'align'),
    hr: withCommonAttrs(),
    br: withCommonAttrs(),
    em: withCommonAttrs(),
    strong: withCommonAttrs(),
    del: withCommonAttrs(),
  },
})

export const sanitizeRenderedHtml = (html: string) =>
  htmlSanitizer.process(html)

export const markdownToHtml = (markdown: string) => {
  return sanitizeRenderedHtml(marked(markdown, { gfm: true }) as string)
}

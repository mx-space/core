import { marked } from 'marked'
import xss from 'xss'

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
        const rule = /^\|\|([\s\S]+?)\|\|(?!\|)/
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
        const rule = /^\$([\s\S]+?)\$(?!\$)/
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
          case 'gallery':
            return `<div class="container">${this.parser.parseInline(
              images,
            )}</div>`
          case 'banner':
            return `<div class="container ${name} ${params}">${this.parser.parse(
              paragraph,
            )}</div>`
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
          `^\\s*::: *(?<name>(${shouldCatchContainerName})) *({(?<params>(.*?))})? *\n(?<content>[\\s\\S]+?)\\s*::: *(?:\n *)+\n?`,
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

export const markdownToHtml = (markdown: string) => {
  return marked(markdown, { gfm: true }) as string
}

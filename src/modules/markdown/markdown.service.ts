import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { dump } from 'js-yaml'
import JSZip from 'jszip'
import { omit } from 'lodash'
import marked from 'marked'
import { Types } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import xss from 'xss'
import { CategoryModel } from '../category/category.model'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { DatatypeDto } from './markdown.dto'
import { MarkdownYAMLProperty } from './markdown.interface'
@Injectable()
export class MarkdownService {
  private logger: Logger
  constructor(
    @InjectModel(CategoryModel)
    private readonly categoryModel: ReturnModelType<typeof CategoryModel>,
    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: ReturnModelType<typeof NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: ReturnModelType<typeof PageModel>,
  ) {
    this.logger = new Logger(MarkdownService.name)
  }

  async insertPostsToDb(data: DatatypeDto[]) {
    let count = 1
    const categoryNameAndId = (await this.categoryModel.find().lean()).map(
      (c) => {
        return { name: c.name, _id: c._id }
      },
    )

    const insertOrCreateCategory = async (name: string) => {
      if (!name) {
        return
      }
      const hasCategory = categoryNameAndId.find((c) => name === c.name)

      if (!hasCategory) {
        const newCategoryDoc = await this.categoryModel.create({
          name,
          slug: name,
          type: 0,
        })
        categoryNameAndId.push({
          name: newCategoryDoc.name,
          _id: newCategoryDoc._id,
        })

        await newCategoryDoc.save()
        return newCategoryDoc
      } else {
        await this.categoryModel.updateOne(
          {
            _id: hasCategory._id,
          },
          {
            $inc: {
              count: 1,
            },
          },
        )
        return hasCategory
      }
    }
    const genDate = this.genDate
    const models = [] as PostModel[]
    const _defaultCategory = await this.categoryModel.findOne()
    const defaultCategory = new Proxy(_defaultCategory, {
      get(target) {
        target.updateOne({
          $inc: {
            count: 1,
          },
        })

        return target
      },
    })
    for await (const item of data) {
      if (!item.meta) {
        models.push({
          title: '未命名-' + count++,
          slug: new Date().getTime(),
          text: item.text,
          ...genDate(item),
          categoryId: Types.ObjectId(defaultCategory._id),
        } as any as PostModel)
      } else {
        const category = await insertOrCreateCategory(
          item.meta.categories?.shift(),
        )
        models.push({
          title: item.meta.title,
          slug: item.meta.slug || item.meta.title,
          text: item.text,
          ...genDate(item),
          categoryId: category?._id || defaultCategory._id,
        } as PostModel)
      }
    }
    return await this.postModel.insertMany(models)
  }
  async insertNotesToDb(data: DatatypeDto[]) {
    const models = [] as NoteModel[]
    for await (const item of data) {
      if (!item.meta) {
        models.push({
          title: '未命名记录',
          text: item.text,
          ...this.genDate(item),
        } as NoteModel)
      } else {
        models.push({
          title: item.meta.title,
          text: item.text,
          ...this.genDate(item),
        } as NoteModel)
      }
    }

    return await this.noteModel.create(models)
  }

  private readonly genDate = (item: DatatypeDto) => {
    const { meta } = item
    if (!meta) {
      return {
        created: new Date(),
        modified: new Date(),
      }
    }
    const { date, updated } = meta
    return {
      created: date ? new Date(date) : new Date(),
      modified: updated
        ? new Date(updated)
        : date
        ? new Date(date)
        : new Date(),
    }
  }

  async extractAllArticle() {
    return {
      posts: await this.postModel.find().populate('category'),
      notes: await this.noteModel.find().lean(),
      pages: await this.pageModel.find().lean(),
    }
  }

  async generateArchive({
    documents,
    options = {},
  }: {
    documents: MarkdownYAMLProperty[]
    options: { slug?: boolean }
  }) {
    const zip = new JSZip()

    for (const document of documents) {
      zip.file(
        (options.slug ? document.meta.slug : document.meta.title)
          .concat('.md')
          .replace(/\//g, '-'),
        document.text,
      )
    }
    return zip
  }

  markdownBuilder(
    property: MarkdownYAMLProperty,
    includeYAMLHeader?: boolean,
    showHeader?: boolean,
  ) {
    const {
      meta: { created, modified, title },
      text,
    } = property
    if (!includeYAMLHeader) {
      return `${showHeader ? `# ${title}\n\n` : ''}${text.trim()}`
    }
    const header = {
      date: created,
      updated: modified,
      title,
      ...omit(property.meta, ['created', 'modified', 'title']),
    }
    const toYaml = dump(header, { skipInvalid: true })
    const res = `
---
${toYaml.trim()}
---

${showHeader ? `# ${title}\n\n` : ''}
${text.trim()}
`.trim()

    return res
  }

  async renderArticle(id: string) {
    const tasks = await Promise.all([
      this.postModel.findById(id).lean(),
      this.noteModel.findById(id).lean(),
      this.pageModel.findById(id).lean(),
    ])
    const document = tasks.find(Boolean)
    if (!document) {
      throw new BadRequestException('文档不存在')
    }
    return { html: this.render(document.text), document }
  }

  private render(text: string) {
    marked.use({
      gfm: true,
      sanitize: false,
      extensions: [
        {
          level: 'inline',
          name: 'spoiler',
          start(src) {
            return src.match(/\|/)?.index
          },
          renderer(token) {
            // @ts-ignore
            return `<span class="spoiler" style="filter: invert(25%)">${this.parser.parseInline(
              token.text,
            )}\n</span>`
          },
          tokenizer(src, tokens) {
            const rule = /^\|\|([\s\S]+?)\|\|(?!\|)/ // Regex for the complete token
            const match = rule.exec(src)
            if (match) {
              return {
                // Token to generate
                type: 'spoiler', // Should match "name" above
                raw: match[0], // Text to consume from the source
                // @ts-ignore
                text: this.lexer.inlineTokens(match[1].trim()),
              }
            }
          },
          childTokens: ['text'],
        },
        {
          level: 'inline',
          name: 'mention',
          start(src) {
            return src.match(/\(/)?.index
          },
          renderer(token) {
            // @ts-ignore
            const username = this.parser.parseInline(token.text).slice(1)
            return `<a class="mention" rel="noreferrer nofollow" href="https://github.com/${username}" target="_blank">@${username}\n</a>`
          },
          tokenizer(src, tokens) {
            const rule = /^\((@(\w+\b))\)\s?(?!\[.*?\])/ // Regex for the complete token
            const match = rule.exec(src)
            if (match) {
              return {
                // Token to generate
                type: 'mention', // Should match "name" above
                raw: match[0], // Text to consume from the source
                text: this.lexer.inlineTokens(match[1].trim(), []),
              }
            }
          },
          childTokens: ['text'],
        },
      ],

      renderer: {
        image(src, title, _alt) {
          const alt = _alt?.match(/^[!¡]/) ? _alt!.replace(/^[¡!]/, '') : ''
          if (!alt) {
            return `<img src="${xss(src)}"/>`
          }
          return `<figure>
          <img src="${xss(src)}"/>
          <figcaption style="text-align: center; margin: 1em auto;">${xss(
            alt,
          )}</figcaption></figure>`
        },

        code(code, lang) {
          if (lang == 'mermaid') {
            return '<div class="mermaid">' + code + '</div>'
          } else {
            return '<pre><code>' + code + '</code></pre>'
          }
        },
      },
    })

    return marked(text)
  }
}

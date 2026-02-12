import { Test } from '@nestjs/testing'
import { LexicalService } from '~/processors/helper/helper.lexical.service'

function makeEditorState(children: any[]) {
  return JSON.stringify({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })
}

function textNode(text: string, format = 0) {
  return {
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraph(...children: any[]) {
  return {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

describe('LexicalService', () => {
  let service: LexicalService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LexicalService],
    }).compile()
    service = moduleRef.get(LexicalService)
  })

  it('converts paragraph', () => {
    const state = makeEditorState([paragraph(textNode('Hello world'))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('Hello world')
  })

  it('converts heading', () => {
    const state = makeEditorState([
      {
        children: [textNode('Title')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h2',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('## Title')
  })

  it('converts bold text', () => {
    const state = makeEditorState([paragraph(textNode('bold', 1))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('**bold**')
  })

  it('converts italic text', () => {
    const state = makeEditorState([paragraph(textNode('italic', 2))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('*italic*')
  })

  it('converts inline code', () => {
    const state = makeEditorState([paragraph(textNode('code', 16))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('`code`')
  })

  it('converts strikethrough', () => {
    const state = makeEditorState([paragraph(textNode('del', 4))])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('~~del~~')
  })

  it('converts unordered list', () => {
    const state = makeEditorState([
      {
        children: [
          {
            children: [textNode('item 1')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
          },
          {
            children: [textNode('item 2')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('- item 1')
    expect(md).toContain('- item 2')
  })

  it('converts ordered list', () => {
    const state = makeEditorState([
      {
        children: [
          {
            children: [textNode('first')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
          },
          {
            children: [textNode('second')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'number',
        start: 1,
        tag: 'ol',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('1. first')
    expect(md).toContain('2. second')
  })

  it('converts blockquote', () => {
    const state = makeEditorState([
      {
        children: [textNode('quoted text')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('> quoted text')
  })

  it('converts code block', () => {
    const state = makeEditorState([
      {
        children: [textNode('const x = 1')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'code',
        version: 1,
        language: 'javascript',
      },
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('```javascript')
    expect(md).toContain('const x = 1')
    expect(md).toContain('```')
  })

  it('converts link', () => {
    const state = makeEditorState([
      paragraph({
        children: [textNode('click here')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'link',
        version: 1,
        rel: null,
        target: null,
        title: null,
        url: 'https://example.com',
      }),
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('[click here](https://example.com)')
  })

  it('converts complex document', () => {
    const state = makeEditorState([
      {
        children: [textNode('My Post')],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h1',
      },
      paragraph(
        textNode('This is '),
        textNode('important', 1),
        textNode(' text.'),
      ),
    ])
    const md = service.lexicalToMarkdown(state)
    expect(md).toContain('# My Post')
    expect(md).toContain('**important**')
  })
})

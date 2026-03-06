import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { Streamdown } from 'streamdown'

interface MarkdownStreamProps {
  content: string
  streaming?: boolean
}

export function MarkdownStream({
  content,
  streaming = false,
}: MarkdownStreamProps) {
  if (streaming) {
    return (
      <Streamdown animated isAnimating plugins={{ code, cjk }}>
        {content}
      </Streamdown>
    )
  }

  return <Streamdown plugins={{ code, cjk }}>{content}</Streamdown>
}

export function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content

  if (content && typeof content === 'object') {
    // pi-agent format: { message: { content: [{ type: 'text', text: '...' }] } }
    const obj = content as Record<string, unknown>

    if ('message' in obj && obj.message && typeof obj.message === 'object') {
      const msg = obj.message as Record<string, unknown>
      if ('content' in msg && Array.isArray(msg.content)) {
        return msg.content
          .filter((c: { type?: string }) => c.type === 'text')
          .map((c: { text?: string }) => c.text || '')
          .join('')
      }
    }

    // Direct content array
    if (Array.isArray(content)) {
      return (content as Array<{ type?: string; text?: string }>)
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('')
    }

    // Plain text field
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text
    }
  }

  return String(content ?? '')
}

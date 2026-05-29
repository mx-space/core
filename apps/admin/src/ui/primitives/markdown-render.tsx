import { useEffect, useState } from 'react'
import { marked } from 'marked'
import xss from 'xss'

import { cn } from '~/utils/cn'

interface MarkdownRenderProps {
  className?: string
  text: string
}

export function MarkdownRender(props: MarkdownRenderProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false

    async function render() {
      if (!props.text) {
        setHtml('')
        return
      }

      const parsed = await marked.parse(props.text, {
        breaks: true,
        gfm: true,
      })

      if (!cancelled) setHtml(xss(parsed))
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [props.text])

  return (
    <div
      className={cn(
        'prose prose-neutral prose-sm dark:prose-invert max-w-none',
        '[&_a]:text-blue-600 [&_a]:dark:text-blue-400',
        '[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:dark:bg-neutral-800',
        '[&_img]:max-w-full [&_img]:rounded-lg',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-50 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:dark:bg-neutral-900',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        props.className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

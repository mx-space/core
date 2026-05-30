import type { SerializedEditorState } from 'lexical'
import { lazy, Suspense, useMemo, useState } from 'react'

import type { AITranslation } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { CodeMirrorEditor } from '~/vendor/codemirror'

import { formatDateString } from '../../utils/ai'
import type { EditDrawerBodyProps } from './types'

const LexicalEmbeddedEditor = lazy(async () => {
  await import('~/vendor/rich-editor/core/style')
  return import('./LexicalEmbeddedEditor')
})

function parseLexical(raw?: string): SerializedEditorState | undefined {
  if (!raw || !raw.trim()) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'root' in parsed) {
      return parsed as SerializedEditorState
    }
  } catch {
    return undefined
  }
  return undefined
}

export function TranslationEditBody(props: EditDrawerBodyProps<AITranslation>) {
  const { t } = useI18n()
  const [title, setTitle] = useState(props.item.title)
  const [subtitle, setSubtitle] = useState(props.item.subtitle ?? '')
  const [summary, setSummary] = useState(props.item.summary ?? '')
  const [text, setText] = useState(props.item.text)

  const initialLexical = useMemo(
    () => parseLexical(props.item.content),
    [props.item.content],
  )
  const useLexical =
    props.item.contentFormat === 'lexical' && Boolean(initialLexical)
  const [lexicalContent, setLexicalContent] = useState<string | undefined>(
    props.item.content,
  )

  const submit = () => {
    if (!title.trim()) return
    if (!useLexical && !text.trim()) return
    const next: AITranslation = {
      ...props.item,
      title,
      subtitle: subtitle || undefined,
      summary: summary || undefined,
      text,
    }
    if (useLexical && lexicalContent) next.content = lexicalContent
    void props.onSubmit(next)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <TextInput
          autoFocus
          label={t('ai.translation.editLabel.title')}
          onChange={setTitle}
          required
          value={title}
        />
        <TextInput
          label={t('ai.translation.editLabel.subtitle')}
          onChange={setSubtitle}
          value={subtitle}
        />
        <section>
          <p className="mb-1.5 text-xs font-medium text-fg">
            {t('ai.translation.editLabel.summary')}
          </p>
          <div className="rounded border border-border">
            <CodeMirrorEditor
              embedded
              onChange={setSummary}
              renderMode="plain"
              text={summary}
            />
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-medium text-fg">
            {t('ai.translation.editLabel.text')}
          </p>
          {useLexical && initialLexical ? (
            <div className="rounded border border-border">
              <Suspense
                fallback={
                  <div className="px-3 py-2 text-xs text-fg-subtle">
                    {t('common.loading')}
                  </div>
                }
              >
                <LexicalEmbeddedEditor
                  contentClassName="px-3 py-2 min-h-40"
                  initialValue={initialLexical}
                  onChange={(value) => setLexicalContent(JSON.stringify(value))}
                />
              </Suspense>
            </div>
          ) : (
            <div className="rounded border border-border">
              <CodeMirrorEditor
                embedded
                onChange={setText}
                renderMode="plain"
                text={text}
              />
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-medium text-fg">
            {t('ai.translation.editLabel.meta')}
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <Row
              label={t('ai.translation.langLabel')}
              value={props.item.lang.toUpperCase()}
            />
            <Row
              label={t('ai.translation.column.source')}
              value={(props.item.sourceLang || '-').toUpperCase()}
            />
            {props.item.contentFormat ? (
              <Row label="Format" value={props.item.contentFormat} />
            ) : null}
            {props.item.aiProvider ? (
              <Row label="Provider" value={props.item.aiProvider} />
            ) : null}
            {props.item.aiModel ? (
              <Row label="Model" value={props.item.aiModel} />
            ) : null}
            <Row
              label={t('ai.task.createdAt')}
              value={formatDateString(props.item.createdAt)}
            />
          </dl>
        </section>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button onClick={props.onCancel} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={
            props.submitting || !title.trim() || (!useLexical && !text.trim())
          }
          onClick={submit}
          type="button"
          variant="primary"
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-fg-muted">{props.label}</dt>
      <dd className="text-fg">{props.value}</dd>
    </div>
  )
}

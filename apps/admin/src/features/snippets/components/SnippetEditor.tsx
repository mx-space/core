import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  ScrollText,
  Trash2,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { CreateSnippetData } from '~/api/snippets'
import { createSnippet, updateSnippet } from '~/api/snippets'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { getSnippetLanguage, SnippetType } from '~/models/snippet'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { CodeEditor } from '~/ui/primitives/code-editor'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  getErrorMessage,
  getSnippetDefaultsForType,
  normalizeSnippet,
  prepareSnippetPayload,
} from '../utils/snippets'
import { SkillFrontmatterPreview } from './SkillFrontmatterPreview'
import { SnippetMetaPopover } from './SnippetMetaPopover'

export function SnippetEditor(props: {
  deleting?: boolean
  initialValue: CreateSnippetData | SnippetModel
  mode: 'create' | 'edit'
  onBack: () => void
  onDelete?: (snippet: SnippetModel) => void
  onInstallDependency?: () => void
  onOpenCompiled?: () => void
  onOpenLogs?: () => void
  onReset?: (snippet: SnippetModel) => void
  onSaved: (snippet: SnippetModel) => void
  resetting?: boolean
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<CreateSnippetData>(() =>
    normalizeSnippet(props.initialValue),
  )

  useEffect(() => {
    setForm(normalizeSnippet(props.initialValue))
  }, [props.initialValue])

  const mutation = useMutation({
    mutationFn: () =>
      props.mode === 'create'
        ? createSnippet(prepareSnippetPayload(form, t))
        : updateSnippet(
            (props.initialValue as SnippetModel).id,
            prepareSnippetPayload(form, t),
          ),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.saveFailed'))),
    onSuccess: (snippet) => {
      toast.success(t('snippets.toast.saved'))
      props.onSaved(snippet)
    },
  })

  const save = () => {
    if (!form.path.trim()) {
      toast.error(t('snippets.toast.nameRequired'))
      return
    }
    mutation.mutate()
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save()
  }

  const editSnippet =
    props.mode === 'edit' ? (props.initialValue as SnippetModel) : null
  const isFunction = form.type === SnippetType.Function
  const isSkill = form.type === SnippetType.Skill
  const isBuiltInFunction = Boolean(editSnippet?.builtIn && isFunction)
  const typeDisabled = Boolean(
    editSnippet && editSnippet.type === SnippetType.Function,
  )

  const changeType = (type: SnippetType) => {
    setForm((current) => ({
      ...current,
      ...getSnippetDefaultsForType(type, current.type, current.raw, t),
      type,
    }))
  }

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <Button
            aria-label={t('snippets.editor.backAria')}
            className="h-8 px-2 lg:hidden"
            onClick={props.onBack}
            type="button"
            variant="subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {props.mode === 'create'
              ? t('snippets.editor.newTitle')
              : form.path || t('snippets.editor.unnamed')}
          </h2>
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {form.type}
          </span>
        </div>
        <Scroll
          className="shrink-0"
          innerClassName="flex items-center gap-2"
          orientation="horizontal"
        >
          {isFunction && editSnippet ? (
            <>
              <Button
                aria-label={t('snippets.editor.action.compiled')}
                className="h-8 w-8"
                iconOnly
                onClick={props.onOpenCompiled}
                title={t('snippets.editor.action.compiled')}
                type="button"
                variant="subtle"
              >
                <FileText aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label={t('snippets.editor.action.logs')}
                className="h-8 w-8"
                iconOnly
                onClick={props.onOpenLogs}
                title={t('snippets.editor.action.logs')}
                type="button"
                variant="subtle"
              >
                <ScrollText aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label={t('snippets.editor.action.install')}
                className="h-8 w-8"
                iconOnly
                onClick={props.onInstallDependency}
                title={t('snippets.editor.action.install')}
                type="button"
                variant="subtle"
              >
                <Download aria-hidden="true" className="size-4" />
              </Button>
            </>
          ) : null}
          <SnippetMetaPopover
            form={form}
            isBuiltInFunction={isBuiltInFunction}
            isFunction={isFunction}
            isSkill={isSkill}
            onChange={setForm}
            onTypeChange={changeType}
            typeDisabled={typeDisabled}
          />
          {editSnippet?.builtIn && props.onReset ? (
            <Button
              aria-label={t('snippets.editor.action.reset')}
              className="h-8 w-8"
              disabled={props.resetting}
              iconOnly
              onClick={() => props.onReset?.(editSnippet)}
              title={t('snippets.editor.action.reset')}
              type="button"
              variant="subtle"
            >
              {props.resetting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RotateCcw aria-hidden="true" className="size-4" />
              )}
            </Button>
          ) : null}
          {editSnippet && props.onDelete ? (
            <Button
              aria-label={t('snippets.editor.action.delete')}
              className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
              disabled={props.deleting}
              iconOnly
              onClick={() => props.onDelete?.(editSnippet)}
              title={t('snippets.editor.action.delete')}
              type="button"
              variant="subtle"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          <Button
            className="h-8 px-3"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {t('snippets.editor.action.save')}
          </Button>
        </Scroll>
      </div>

      {isSkill ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 desktop:flex-row">
          <div className="min-h-0 desktop:flex-1">
            <CodeEditor
              className="h-full"
              language={getSnippetLanguage(form.path, form.type)}
              onChange={(raw) => setForm((current) => ({ ...current, raw }))}
              onSave={save}
              title={form.path}
              value={form.raw}
            />
          </div>
          <div className="shrink-0 overflow-auto desktop:w-[36%]">
            <SkillFrontmatterPreview form={form} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <CodeEditor
            className="h-full"
            language={getSnippetLanguage(form.path, form.type)}
            onChange={(raw) => setForm((current) => ({ ...current, raw }))}
            onSave={save}
            title={form.path}
            value={form.raw}
          />
        </div>
      )}
    </form>
  )
}

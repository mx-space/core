import { Check, X } from 'lucide-react'

import type { CreateSnippetData } from '~/api/snippets'
import { useI18n } from '~/i18n'

import { parseSkillFrontmatter } from '../utils/snippets'

export function SkillFrontmatterPreview({ form }: { form: CreateSnippetData }) {
  const { t } = useI18n()
  const result = parseSkillFrontmatter(form.raw)

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
        {t('snippets.editor.skill.frontmatter')}
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs text-fg-muted">
            {t('snippets.editor.skill.name')}
          </p>
          {!result.ok ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {t('snippets.editor.skill.parseError')}: {result.errorMessage}
            </p>
          ) : result.name === undefined ? (
            <p className="text-sm text-fg-subtle">—</p>
          ) : result.name === form.name.trim() ? (
            <span className="flex items-center gap-1 text-sm text-fg">
              <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              {result.name}
            </span>
          ) : (
            <div>
              <span className="flex items-center gap-1 text-sm text-fg">
                <X className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                {result.name}
              </span>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {t('snippets.editor.skill.nameMismatch', { value: form.name })}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-fg-muted">
            {t('snippets.editor.skill.description')}
          </p>
          {!result.ok || result.name === undefined ? (
            <p className="text-sm text-fg-subtle">—</p>
          ) : !result.description ? (
            <div>
              <span className="flex items-center gap-1 text-sm text-fg">
                <X className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                —
              </span>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {t('snippets.editor.skill.descriptionRequired')}
              </p>
            </div>
          ) : (
            <p className="truncate text-sm text-fg">{result.description}</p>
          )}
        </div>

        {result.ok && result.unknownKeys.length > 0 && (
          <div>
            <p className="text-xs text-fg-muted">
              {t('snippets.editor.skill.unknownKeys')}
            </p>
            <ul className="mt-1 space-y-0.5">
              {result.unknownKeys.map(({ key, preview }) => (
                <li key={key} className="font-mono text-xs text-fg-muted">
                  {key}: {preview}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

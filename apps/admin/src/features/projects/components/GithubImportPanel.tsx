import { useMutation } from '@tanstack/react-query'
import { Import as ImportIcon, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { GithubRepo } from '~/api/github-repo'

import { getRepoDetail, getRepoReadme } from '~/api/github-repo'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import { getErrorMessage, parseGithubRepo } from '../utils/projects'

export function GithubImportPanel(props: {
  defaultValue?: string
  onApply: (repo: GithubRepo, readme: string | null) => void
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState(props.defaultValue ?? '')
  const importMutation = useMutation({
    mutationFn: async () => {
      const repo = parseGithubRepo(url)
      const [detail, readme] = await Promise.all([
        getRepoDetail(repo.owner, repo.repo),
        getRepoReadme(repo.owner, repo.repo),
      ])

      return { detail, readme }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message === 'projects.github.invalidUrl'
          ? t('projects.github.invalidUrl')
          : getErrorMessage(error, t('projects.github.fetchFailed'))
      toast.error(message)
    },
    onSuccess: ({ detail, readme }) => {
      props.onApply(detail, readme)
      toast.success(t('projects.github.applied'))
    },
  })

  return (
    <section className="grid gap-3 border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
        <ImportIcon aria-hidden="true" className="size-4" />
        {t('projects.github.title')}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          className="flex-1"
          onChange={setUrl}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              importMutation.mutate()
            }
          }}
          placeholder={t('projects.github.placeholder')}
          value={url}
        />
        <Button
          disabled={importMutation.isPending}
          onClick={() => importMutation.mutate()}
          type="button"
        >
          {importMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ImportIcon aria-hidden="true" className="size-4" />
          )}
          {t('projects.github.fetch')}
        </Button>
      </div>
    </section>
  )
}

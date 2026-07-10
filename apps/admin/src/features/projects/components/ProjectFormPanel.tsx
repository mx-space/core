import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Import as ImportIcon, Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { GithubRepo } from '~/api/github-repo'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { saveProject } from '~/data/resources/project.mutations'
import { useI18n } from '~/i18n'
import type { ProjectModel } from '~/models/project'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextArea, TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { emptyProjectForm } from '../constants'
import type { ProjectFormMode, ProjectFormState } from '../types/projects'
import {
  formToPayload,
  pickImagesFromMarkdown,
  projectToForm,
} from '../utils/projects'
import { GithubImportPanel } from './GithubImportPanel'
import { ImagePreview } from './ProjectImageGrid'

export function ProjectFormPanel(props: {
  mode: ProjectFormMode
  onCancel: () => void
  onMobileBack: () => void
  onSuccess: (project: ProjectModel) => Promise<void>
  project: ProjectModel | null
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<ProjectFormState>(() =>
    props.project ? projectToForm(props.project) : emptyProjectForm,
  )
  const [githubImportOpen, setGithubImportOpen] = useState(false)
  const [error, setError] = useState('')
  const isEdit = props.mode === 'edit' && Boolean(props.project?.id)
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = formToPayload(form)
      const mode = props.project?.id
        ? { id: props.project.id, kind: 'edit' as const }
        : { kind: 'create' as const }

      return saveProject(mode, payload)
    },
    onSuccess: async (project) => {
      toast.success(
        isEdit
          ? t('projects.form.toast.saved')
          : t('projects.form.toast.created'),
      )
      await props.onSuccess(project)
    },
  })

  useEffect(() => {
    setForm(props.project ? projectToForm(props.project) : emptyProjectForm)
    setError('')
  }, [props.project])

  const updateField = (key: keyof ProjectFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const applyGithubRepo = (repo: GithubRepo, readme: string | null) => {
    const images = pickImagesFromMarkdown(readme ?? '')

    setForm((current) => ({
      ...current,
      description: repo.description ?? '',
      images,
      imagesText: images.join('\n'),
      name: repo.name || current.name,
      previewUrl: repo.homepage ?? '',
      projectUrl: repo.html_url || current.projectUrl,
      text: readme ?? current.text,
    }))
    setGithubImportOpen(false)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!form.name.trim()) {
      setError(t('projects.form.validate.name'))
      return
    }
    if (!form.text.trim()) {
      setError(t('projects.form.validate.text'))
      return
    }

    setError('')
    mutation.mutate()
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-card">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <Button
            aria-label={t('projects.form.returnAria')}
            className="h-8 px-2 lg:hidden"
            onClick={props.onMobileBack}
            type="button"
            variant="subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {isEdit
              ? t('projects.form.editTitle')
              : t('projects.form.createTitle')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setGithubImportOpen((value) => !value)}
            type="button"
            variant="subtle"
          >
            <ImportIcon aria-hidden="true" className="size-4" />
            {t('projects.form.fromGithub')}
          </Button>
          <Button onClick={props.onCancel} type="button" variant="subtle">
            <X aria-hidden="true" className="size-4" />
            {t('common.cancel')}
          </Button>
          <Button
            disabled={mutation.isPending}
            form="project-form"
            type="submit"
          >
            <Save aria-hidden="true" className="size-4" />
            {isEdit ? t('common.save') : t('projects.form.create')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1">
        <form id="project-form" onSubmit={handleSubmit}>
          <div className="mx-auto grid max-w-3xl gap-4 p-6">
            {githubImportOpen ? (
              <GithubImportPanel
                defaultValue={form.projectUrl}
                onApply={applyGithubRepo}
              />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label={t('projects.form.field.name')}
                onChange={(value) => updateField('name', value)}
                required
                value={form.name}
              />
              <TextInput
                label={t('projects.form.field.avatar')}
                onChange={(value) => updateField('avatar', value)}
                value={form.avatar ?? ''}
              />
            </div>
            <TextInput
              label={t('projects.form.field.description')}
              onChange={(value) => updateField('description', value)}
              value={form.description}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput
                label={t('projects.form.field.projectUrl')}
                onChange={(value) => updateField('projectUrl', value)}
                value={form.projectUrl ?? ''}
              />
              <TextInput
                label={t('projects.form.field.previewUrl')}
                onChange={(value) => updateField('previewUrl', value)}
                value={form.previewUrl ?? ''}
              />
              <TextInput
                label={t('projects.form.field.docUrl')}
                onChange={(value) => updateField('docUrl', value)}
                value={form.docUrl ?? ''}
              />
            </div>
            <TextArea
              controlClassName="min-h-20"
              label={t('projects.form.field.images')}
              onChange={(value) => updateField('imagesText', value)}
              placeholder={t('projects.form.field.imagesPlaceholder')}
              value={form.imagesText}
            />
            <ImagePreview imagesText={form.imagesText} />
            <TextArea
              controlClassName="min-h-72 font-mono"
              label={t('projects.form.field.text')}
              onChange={(value) => updateField('text', value)}
              required
              value={form.text}
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
        </form>
      </Scroll>
    </section>
  )
}

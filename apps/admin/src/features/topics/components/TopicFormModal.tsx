import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Save, Upload } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import type { CreateTopicData } from '~/api/topics'
import { getTopic } from '~/api/topics'
import { saveTopic } from '~/data/resources/topic.mutations'
import { useI18n } from '~/i18n'
import type { TopicModel } from '~/models/topic'
import { adminQueryKeys } from '~/query/keys'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

import type { TopicFormMode } from '../types/topics'
import { getErrorMessage } from '../utils/errors'
import { validateTopicForm } from '../utils/topic-form'

interface TopicFormModalProps {
  mode: TopicFormMode
}

function TopicFormModal(props: TopicFormModalProps) {
  const { t } = useI18n()
  const modal = useModal<TopicModel>()
  const isEdit = props.mode.kind === 'edit'
  const editId = props.mode.kind === 'edit' ? props.mode.id : null
  const topicQuery = useQuery({
    enabled: isEdit,
    queryFn: () => getTopic(editId ?? ''),
    queryKey: editId
      ? [...adminQueryKeys.topics.detail(editId), 'form']
      : adminQueryKeys.topics.root,
  })
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [introduce, setIntroduce] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const iconInputRef = useRef<HTMLInputElement>(null)

  const iconUploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'icon'),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.form.iconUploadFailed'))),
    onSuccess: (result) => {
      setIcon(result.url)
      toast.success(t('topics.form.iconUploadSuccess'))
    },
  })

  useEffect(() => {
    if (!topicQuery.data) return
    setName(topicQuery.data.name)
    setSlug(topicQuery.data.slug)
    setIntroduce(topicQuery.data.introduce ?? '')
    setDescription(topicQuery.data.description ?? '')
    setIcon(topicQuery.data.icon ?? '')
  }, [topicQuery.data])

  const mutation = useMutation({
    mutationFn: (data: CreateTopicData) =>
      saveTopic(
        editId ? { id: editId, kind: 'edit' } : { kind: 'create' },
        data,
      ),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.form.saveFailed'))),
    onSuccess: (topic) => {
      if (!topic) return
      toast.success(
        isEdit ? t('topics.form.savedUpdated') : t('topics.form.savedCreated'),
      )
      modal.close(topic)
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = {
      description: description.trim(),
      icon: icon.trim(),
      introduce: introduce.trim(),
      name: name.trim(),
      slug: slug.trim(),
    }

    const validationError = validateTopicForm(data)
    if (validationError) {
      toast.error(t(validationError.key, validationError.values))
      return
    }

    mutation.mutate(data)
  }

  return (
    <form className="flex w-full flex-col" onSubmit={onSubmit}>
      <ModalHeader
        subtitle={t('topics.form.subtitle')}
        title={
          isEdit ? t('topics.form.editTitle') : t('topics.form.createTitle')
        }
      />

      {isEdit && topicQuery.isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2
            aria-hidden="true"
            className="size-6 animate-spin text-neutral-400"
          />
        </div>
      ) : (
        <div className="grid gap-4 px-5 py-4">
          <TextInput
            autoFocus
            label={t('topics.form.name')}
            labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
            maxLength={50}
            onChange={setName}
            required
            value={name}
          />
          <div>
            <TextInput
              controlClassName="font-mono"
              label={t('topics.form.slug')}
              labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
              onChange={setSlug}
              required
              value={slug}
            />
            <p className="mt-1 text-xs text-neutral-400">
              {t('topics.form.slugHelp')}
            </p>
          </div>
          <TextInput
            label={t('topics.form.introduce')}
            labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
            maxLength={100}
            onChange={setIntroduce}
            required
            value={introduce}
          />
          <div className="grid gap-1.5 text-sm">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('topics.form.icon')}
            </label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <TextInput onChange={setIcon} value={icon} />
              </div>
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) iconUploadMutation.mutate(file)
                }}
                ref={iconInputRef}
                type="file"
              />
              <Button
                aria-label={t('topics.form.iconUpload')}
                disabled={iconUploadMutation.isPending}
                onClick={() => iconInputRef.current?.click()}
                title={t('topics.form.iconUpload')}
                type="button"
                variant="subtle"
              >
                {iconUploadMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Upload aria-hidden="true" className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <TextArea
            controlClassName="min-h-28"
            label={t('topics.form.description')}
            labelClassName="text-xs text-neutral-500 dark:text-neutral-400"
            maxLength={500}
            onChange={setDescription}
            value={description}
          />
        </div>
      )}

      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={mutation.isPending || (isEdit && topicQuery.isLoading)}
          type="submit"
        >
          {mutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {t('common.save')}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the topic form modal. Resolves with the saved topic on success.
 */
export async function presentTopicForm(
  mode: TopicFormMode,
): Promise<TopicModel | undefined> {
  const handle = present<TopicFormModalProps, TopicModel>(
    TopicFormModal,
    { mode },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 36rem)' } },
    },
  )
  return await handle
}

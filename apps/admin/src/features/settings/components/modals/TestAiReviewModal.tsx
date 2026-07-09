import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { testCommentReview } from '~/api/ai'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'

import { getErrorMessage } from '../../utils/settings'

function TestAiReviewModal() {
  const { t } = useI18n()
  const modal = useModal<void>()
  const [text, setText] = useState('')

  const mutation = useMutation({
    mutationFn: () => testCommentReview({ text }),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.common.error.testAiReviewFailed')),
      ),
    onSuccess: (result) => {
      const scoreSuffix =
        result.score === undefined
          ? ''
          : t('settings.system.test.scoreSuffix', { score: result.score })
      if (result.isSpam) {
        const reasonSuffix = result.reason
          ? t('settings.system.test.reasonSuffix', { reason: result.reason })
          : ''
        toast.warning(
          t('settings.system.test.aiSpam', { scoreSuffix, reasonSuffix }),
        )
      } else {
        toast.success(t('settings.system.test.aiNormal', { scoreSuffix }))
      }
      modal.close()
    },
  })

  const submit = () => {
    if (!text.trim()) {
      toast.warning(t('settings.system.section.testInputRequired'))
      return
    }
    mutation.mutate()
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={t('settings.system.section.testAiModal')} />
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <TextArea
          controlClassName="min-h-28"
          label={t('settings.system.section.commentLabel')}
          onChange={setText}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              (event.metaKey || event.ctrlKey) &&
              !mutation.isPending
            ) {
              submit()
            }
          }}
          placeholder={t('settings.system.placeholder.testAi')}
          value={text}
        />
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            {t('common.cancel')}
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {t('settings.system.section.testButton')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function presentTestAiReview() {
  return present(
    TestAiReviewModal,
    {},
    { modalProps: { popupStyle: { width: 'min(92vw, 36rem)' } } },
  )
}

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { FormEvent } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'

import { parsePackageInput } from '../utils/snippets'
import { Field, Modal } from './SnippetPrimitives'

export function InstallDependencyModal(props: {
  initialPackages: string
  onInstall: (packages: string[]) => void
  onClose: () => void
  open: boolean
}) {
  const { t } = useI18n()
  const [input, setInput] = useState(props.initialPackages)

  useEffect(() => {
    if (props.open) setInput(props.initialPackages)
  }, [props.initialPackages, props.open])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const packages = parsePackageInput(input)
    if (packages.length === 0) {
      toast.error(t('snippets.toast.dependencyNameRequired'))
      return
    }
    props.onInstall(packages)
    props.onClose()
  }

  return (
    <Modal
      onClose={props.onClose}
      open={props.open}
      title={t('snippets.dialog.install.title')}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label={t('snippets.dialog.install.field')}>
          <TextArea
            controlClassName="min-h-28 resize-y font-mono text-xs"
            onChange={setInput}
            placeholder={t('snippets.dialog.install.placeholder')}
            spellCheck={false}
            value={input}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit">
            <Download aria-hidden="true" className="size-4" />
            {t('snippets.dialog.install.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

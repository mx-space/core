import { Settings } from 'lucide-react'
import { useState } from 'react'

import type { CreateSnippetData } from '~/api/snippets'
import { useI18n } from '~/i18n'
import type { SnippetType } from '~/models/snippet'
import { Popover } from '~/ui/overlay/popover'
import { Checkbox } from '~/ui/primitives/checkbox'
import { SelectField } from '~/ui/primitives/select'
import { TextArea, TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { snippetTypes } from '../constants'
import { serializeSnippetSecret } from '../utils/snippets'
import { Field } from './SnippetPrimitives'

interface SnippetMetaPopoverProps {
  form: CreateSnippetData
  onChange: (next: CreateSnippetData) => void
  onTypeChange: (type: SnippetType) => void
  isFunction: boolean
  isBuiltInFunction: boolean
  isSkill: boolean
  typeDisabled: boolean
}

export function SnippetMetaPopover(props: SnippetMetaPopoverProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const { isSkill } = props

  const patch = (next: Partial<CreateSnippetData>) =>
    props.onChange({ ...props.form, ...next })

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label={t('snippets.editor.action.settings')}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-sm border text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/15',
          open
            ? 'border-border-strong bg-surface-inset text-fg'
            : 'border-border bg-surface-card text-fg-muted hover:bg-surface-inset hover:text-fg',
        )}
        title={t('snippets.editor.action.settings')}
        type="button"
      >
        <Settings aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Content align="end" side="bottom" sideOffset={8} width="lg">
        <div className="flex flex-col overflow-hidden">
          <Popover.Header>
            <span>{t('snippets.editor.action.settings')}</span>
          </Popover.Header>
          <div className="max-h-[70vh] overflow-auto px-4 py-4">
            <div className="space-y-4">
              <Field label={t('snippets.editor.field.name')}>
                <TextInput
                  controlClassName="h-9"
                  disabled={props.isBuiltInFunction}
                  onChange={(name) => patch({ name })}
                  value={props.form.name}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('snippets.editor.field.type')}>
                  <SelectField
                    disabled={props.typeDisabled}
                    onValueChange={props.onTypeChange}
                    options={snippetTypes.map((type) => ({
                      label: type,
                      value: type,
                    }))}
                    triggerClassName="h-9"
                    value={props.form.type}
                  />
                </Field>
                <Field label={t('snippets.editor.field.group')}>
                  <TextInput
                    controlClassName="h-9"
                    disabled={props.isBuiltInFunction}
                    onChange={(reference) => patch({ reference })}
                    value={props.form.reference ?? ''}
                  />
                </Field>
              </div>
              <Field label={t('snippets.editor.field.comment')}>
                <TextInput
                  controlClassName="h-9"
                  disabled={isSkill}
                  onChange={(comment) => patch({ comment })}
                  value={props.form.comment ?? ''}
                />
                {isSkill && (
                  <p className="mt-1 text-xs text-fg-muted">
                    {t('snippets.editor.skill.commentReadOnly')}
                  </p>
                )}
              </Field>
              {!isSkill && (
                <Field label="Metatype">
                  <TextInput
                    controlClassName="h-9"
                    onChange={(metatype) => patch({ metatype })}
                    value={props.form.metatype ?? ''}
                  />
                </Field>
              )}
            </div>

            <SectionDivider />

            <div className="space-y-3">
              <Checkbox
                checked={Boolean(props.form.private)}
                disabled={props.isBuiltInFunction}
                label={t('snippets.editor.field.private')}
                onCheckedChange={(checked) => patch({ private: checked })}
              />
              {props.isFunction ? (
                <Checkbox
                  checked={Boolean(props.form.enable)}
                  disabled={props.isBuiltInFunction}
                  label={t('snippets.editor.field.enable')}
                  onCheckedChange={(checked) => patch({ enable: checked })}
                />
              ) : null}
            </div>

            {!isSkill && (
              <>
                <SectionDivider />

                <div className="space-y-4">
                  {props.isFunction ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Method">
                          <TextInput
                            controlClassName="h-9"
                            disabled={props.isBuiltInFunction}
                            onChange={(method) => patch({ method })}
                            value={props.form.method ?? ''}
                          />
                        </Field>
                        <Field label="Path">
                          <TextInput
                            controlClassName="h-9"
                            onChange={(customPath) => patch({ customPath })}
                            value={props.form.customPath ?? ''}
                          />
                        </Field>
                      </div>
                      <Field label="Secret">
                        <TextArea
                          controlClassName="min-h-24 resize-y font-mono text-xs"
                          onChange={(secret) => patch({ secret })}
                          spellCheck={false}
                          value={serializeSnippetSecret(props.form.secret)}
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label="Schema">
                      <TextArea
                        controlClassName="min-h-24 resize-y font-mono text-xs"
                        onChange={(schema) => patch({ schema })}
                        spellCheck={false}
                        value={props.form.schema ?? ''}
                      />
                    </Field>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Popover.Content>
    </Popover>
  )
}

function SectionDivider() {
  return (
    <div
      aria-hidden="true"
      className="my-4 h-px bg-neutral-200 dark:bg-neutral-800"
    />
  )
}

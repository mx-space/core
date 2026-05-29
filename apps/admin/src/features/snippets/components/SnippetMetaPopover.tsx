import { Popover } from '@base-ui/react/popover'
import { Settings } from 'lucide-react'
import { useState } from 'react'
import type { CreateSnippetData } from '~/api/snippets'

import { useI18n } from '~/i18n'
import { SnippetType } from '~/models/snippet'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
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
  typeDisabled: boolean
}

export function SnippetMetaPopover(props: SnippetMetaPopoverProps) {
  const { t } = useI18n()
  const { z, depth } = useFloatingZ('popover')
  const [open, setOpen] = useState(false)

  const patch = (next: Partial<CreateSnippetData>) =>
    props.onChange({ ...props.form, ...next })

  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label={t('snippets.editor.action.settings')}
        className={cn(
          'focus-visible:outline-hidden inline-flex h-8 w-8 items-center justify-center rounded border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400',
          open
            ? 'border-neutral-300 bg-neutral-100 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50'
            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900',
        )}
        title={t('snippets.editor.action.settings')}
        type="button"
      >
        <Settings aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="end"
          side="bottom"
          sideOffset={8}
          style={{ zIndex: z }}
        >
          <PortalLayerScope depth={depth}>
            <Popover.Popup className="outline-hidden flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-md border border-neutral-200 bg-white text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex shrink-0 items-center border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {t('snippets.editor.action.settings')}
                </span>
              </div>
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
                      onChange={(comment) => patch({ comment })}
                      value={props.form.comment ?? ''}
                    />
                  </Field>
                  <Field label="Metatype">
                    <TextInput
                      controlClassName="h-9"
                      onChange={(metatype) => patch({ metatype })}
                      value={props.form.metatype ?? ''}
                    />
                  </Field>
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
              </div>
            </Popover.Popup>
          </PortalLayerScope>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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

import { Info } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useRef } from 'react'

import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Popover } from '~/ui/overlay/popover'
import { Button } from '~/ui/primitives/button'
import { Combobox } from '~/ui/primitives/combobox'

import type { AIProviderModel } from '../../types/settings'
import type { SerializedPricingTable } from '../../utils/aiModelPricing'
import { serializeAIModelPricing } from '../../utils/aiModelPricing'

const rowLabels: Record<string, TranslationKey> = {
  textInput: 'settings.ai.pricing.textInput',
  textOutput: 'settings.ai.pricing.textOutput',
  textInput_cacheRead: 'settings.ai.pricing.textInput_cacheRead',
  textInput_cacheWrite: 'settings.ai.pricing.textInput_cacheWrite',
  imageInput: 'settings.ai.pricing.imageInput',
  imageOutput: 'settings.ai.pricing.imageOutput',
  audioInput: 'settings.ai.pricing.audioInput',
  audioOutput: 'settings.ai.pricing.audioOutput',
  videoInput: 'settings.ai.pricing.videoInput',
  request: 'settings.ai.pricing.request',
}

export function openHighlightedModelPricing(
  event: KeyboardEvent<HTMLInputElement>,
) {
  if (!event.altKey || event.key !== 'ArrowRight') return
  const id = event.currentTarget.getAttribute('aria-activedescendant')
  const button = id
    ? document
        .getElementById(id)
        ?.parentElement?.querySelector<HTMLButtonElement>(
          '[data-model-pricing-trigger]',
        )
    : null
  if (!button) return
  event.preventDefault()
  button.click()
}

export function AIModelOption({
  id,
  model,
  open,
  onOpenChange,
}: {
  id: string
  model?: AIProviderModel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const rowRef = useRef<HTMLDivElement>(null)
  const name = model?.name || id
  const tables = serializeAIModelPricing(model?.pricing)
  const currency = model?.pricing?.currency ?? 'USD'
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumSignificantDigits: 6,
  })
  const price = (rate: number | null) =>
    rate === null ? '—' : formatter.format(rate)
  const columnLabel = (
    table: SerializedPricingTable,
    index: number,
  ): string => {
    const column = table.columns[index]
    if (table.strategy === 'fixed') return t('settings.ai.pricing.price')
    if (table.strategy === 'tiered') {
      const previous = table.columns[index - 1]
      const count = (value: number | string) =>
        typeof value === 'number' ? value.toLocaleString('en-US') : value
      if (column === 'infinity')
        return typeof previous === 'number'
          ? t('settings.ai.pricing.inputOver', { limit: count(previous) })
          : t('settings.ai.pricing.allInputs')
      return typeof previous === 'number'
        ? t('settings.ai.pricing.inputBetween', {
            from: count(previous),
            limit: count(column),
          })
        : t('settings.ai.pricing.inputUpTo', { limit: count(column) })
    }
    const ttl =
      table.params?.length === 1 && table.params[0] === 'ttl'
        ? String(column).match(/^(\d+)(m|h)$/)
        : null
    return ttl
      ? t(
          ttl[2] === 'm'
            ? 'settings.ai.pricing.minutes'
            : 'settings.ai.pricing.hours',
          { count: Number(ttl[1]) },
        )
      : String(column)
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        ref={rowRef}
        className="flex min-w-0 items-center rounded-sm data-[open]:bg-surface-inset"
        data-open={open ? '' : undefined}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onOpenChange(false)
        }}
      >
        <Combobox.Item className="min-w-0 flex-1" value={id}>
          <span className="block truncate text-sm">{name}</span>
          {name !== id ? (
            <span className="block truncate text-xs text-fg-muted">{id}</span>
          ) : null}
        </Combobox.Item>
        {tables.length ? (
          <Popover.Trigger
            data-model-pricing-trigger=""
            aria-keyshortcuts="Alt+ArrowRight"
            aria-label={t('settings.ai.pricing.details', { model: name })}
            title={t('settings.ai.pricing.keyboardHint')}
            className="mr-1 shrink-0"
            render={<Button iconOnly variant="ghost" />}
          >
            <Info aria-hidden="true" className="size-4" />
          </Popover.Trigger>
        ) : null}
      </div>
      <Popover.Content
        anchor={rowRef}
        align="start"
        side="right"
        sideOffset={8}
        width="lg"
        initialFocus={false}
        finalFocus={false}
        aria-label={t('settings.ai.pricing.details', { model: name })}
      >
        <div className="max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto p-4">
          {tables.flatMap((table, tableIndex) => {
            const sections: ReactNode[] = []
            for (let start = 0; start < table.columns.length; start += 2) {
              sections.push(
                <div key={`${tableIndex}-${start}`}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-fg-muted">
                    <span>{t(`settings.ai.pricing.unit.${table.unit}`)}</span>
                    <span>{currency}</span>
                  </div>
                  <table className="w-full table-fixed border-collapse text-sm tabular-nums">
                    <thead className="bg-surface-inset text-fg-muted">
                      <tr>
                        <th
                          className="rounded-l-xs px-2 py-2 text-left font-normal"
                          scope="col"
                        >
                          {t('settings.ai.pricing.item')}
                        </th>
                        {table.columns
                          .slice(start, start + 2)
                          .map((_, index) => (
                            <th
                              key={index}
                              scope="col"
                              className="whitespace-normal px-2 py-2 text-right font-normal"
                            >
                              {columnLabel(table, start + index)}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-border last:border-0"
                        >
                          <th
                            scope="row"
                            className="px-2 py-2 text-left font-normal text-fg-muted"
                          >
                            {t(
                              rowLabels[row.name] ??
                                'settings.ai.pricing.other',
                            )}
                          </th>
                          {row.rates
                            .slice(start, start + 2)
                            .map((rate, index) => (
                              <td
                                key={index}
                                className="whitespace-nowrap px-2 py-2 text-right text-fg"
                              >
                                {price(rate)}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>,
              )
            }
            return sections
          })}
        </div>
      </Popover.Content>
    </Popover>
  )
}

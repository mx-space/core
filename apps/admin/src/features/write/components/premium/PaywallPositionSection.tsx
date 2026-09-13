import { useEffect, useMemo } from 'react'

import { useI18n } from '~/i18n'
import { Slider } from '~/ui/primitives/slider'

import {
  collectLexicalText,
  parseLexicalTopLevelBlocks,
} from './lexical-blocks'
import { DEFAULT_PREVIEW_BLOCKS } from './paywall-meta'

const CUTOFF_TEXT_LENGTH = 30

export function PaywallPositionSection(props: {
  content: string
  onChange: (value: string) => void
  previewBlocks: string
}) {
  const { t } = useI18n()
  const { onChange } = props
  const blocks = useMemo(
    () => parseLexicalTopLevelBlocks(props.content),
    [props.content],
  )
  const maxPreview = blocks.length - 1
  const tooShort = maxPreview < 1
  const stored = Math.max(
    1,
    Math.floor(Number(props.previewBlocks)) || DEFAULT_PREVIEW_BLOCKS,
  )
  const value = Math.min(stored, Math.max(1, maxPreview))

  useEffect(() => {
    if (!tooShort && stored !== value) {
      onChange(String(value))
    }
  }, [onChange, stored, tooShort, value])

  const cutoffText = useMemo(() => {
    if (tooShort) return ''
    for (let index = value - 1; index >= 0; index -= 1) {
      const text = collectLexicalText(blocks[index]).trim()
      if (text) {
        return text.length > CUTOFF_TEXT_LENGTH
          ? `…${text.slice(-CUTOFF_TEXT_LENGTH)}`
          : text
      }
    }
    return ''
  }, [blocks, tooShort, value])

  return (
    <div className="grid gap-1">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium text-fg">
          {t('write.premium.paywall.title')}
        </span>
        <span className="text-xs text-fg-muted">
          {t('write.premium.paywall.description')}
        </span>
      </div>
      <Slider
        aria-label={t('write.postFields.premiumPreviewBlocks')}
        disabled={tooShort || maxPreview < 2}
        max={Math.max(2, maxPreview)}
        min={1}
        onValueChange={(next) => onChange(String(next))}
        value={tooShort ? 1 : value}
        valueLabel={
          tooShort
            ? null
            : t('write.postFields.premiumPreviewCount', {
                total: blocks.length,
                value,
              })
        }
      />
      {tooShort ? (
        <p className="text-xs text-fg-muted">
          {t('write.postFields.premiumNeedsMoreBlocks')}
        </p>
      ) : cutoffText ? (
        <p className="truncate text-xs text-fg-muted">
          {t('write.postFields.premiumPreviewCutoff', {
            text: `“${cutoffText}”`,
          })}
        </p>
      ) : null}
    </div>
  )
}

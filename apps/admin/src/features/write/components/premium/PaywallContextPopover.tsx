import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'
import { cn } from '~/utils/cn'

import {
  blockPreviewText,
  blockType,
  selectContextBlocks,
} from './paywall-context'

const TYPE_LABEL_KEYS = {
  code: 'write.premium.paywall.context.code',
  horizontalrule: 'write.premium.paywall.context.hr',
  image: 'write.premium.paywall.context.image',
} as const

export function PaywallContextPopover(props: {
  anchor: HTMLElement | null
  blocks: unknown[]
  open: boolean
  value: number
}) {
  const { t } = useI18n()
  const { after, before, cut } = selectContextBlocks(props.blocks, props.value)

  const renderBlock = (
    block: unknown,
    emphasis: 'cut' | 'locked' | 'muted',
  ) => {
    const type = blockType(block)
    const text = blockPreviewText(block)
    const key = TYPE_LABEL_KEYS[type as keyof typeof TYPE_LABEL_KEYS]
    const label = key
      ? t(key)
      : t('write.premium.paywall.context.other', { type })
    return (
      <p
        className={cn(
          'break-words text-sm leading-relaxed',
          type === 'heading' && 'font-medium',
          emphasis === 'cut' && 'border-l-2 border-accent pl-2 text-fg',
          emphasis === 'muted' && 'text-fg-muted',
          emphasis === 'locked' && 'text-fg opacity-50',
        )}
      >
        {text || <span className="text-fg-subtle">{label}</span>}
      </p>
    )
  }

  return (
    <Popover open={props.open}>
      <Popover.Content
        align="center"
        anchor={props.anchor}
        className="max-h-[70vh] overflow-auto"
        finalFocus={false}
        initialFocus={false}
        side="left"
        sideOffset={12}
        width="lg"
      >
        <Popover.Body className="grid gap-2">
          {before.map((block, index) => (
            <div key={props.value - before.length + index}>
              {renderBlock(block, 'muted')}
            </div>
          ))}
          <div className="grid gap-1">
            {renderBlock(cut, 'cut')}
            <span className="pl-2.5 text-xs text-fg-muted">
              {t('write.premium.paywall.context.readersStop', {
                n: props.value,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-border" />
            {t('write.premium.paywall.context.divider')}
            <span className="h-px flex-1 bg-border" />
          </div>
          {after === undefined ? null : renderBlock(after, 'locked')}
        </Popover.Body>
      </Popover.Content>
    </Popover>
  )
}

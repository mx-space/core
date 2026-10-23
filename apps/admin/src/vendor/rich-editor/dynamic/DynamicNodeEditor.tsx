import type { DynamicNode } from '@haklex/rich-ext-dynamic'
import { $isDynamicNode, DynamicHostRenderer } from '@haklex/rich-ext-dynamic'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey, HISTORY_MERGE_TAG } from 'lexical'
import { ArrowLeft, Boxes, Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'
import { PropsEditor } from '~/ui/patterns/PropsEditor'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import {
  currentCatalogEntries,
  resolveCatalogEntry,
  useDynamicCatalog,
} from '../utils/dynamic-catalog'
import { $applyCatalogEntry } from './CatalogDynamicEditNode'
import { CatalogPicker } from './CatalogPicker'
import { ManualDynamicForm } from './ManualDynamicForm'

type PanelView = 'manual' | 'picker' | 'props'

export function DynamicNodeEditor(props: {
  componentProps: Record<string, unknown>
  initialHeight: number
  nodeKey: string
  url: string
}) {
  const { t } = useI18n()
  const [editor] = useLexicalComposerContext()
  const catalog = useDynamicCatalog()
  const resolved =
    props.url && catalog
      ? resolveCatalogEntry(catalog.components, props.url)
      : null
  const [open, setOpen] = useState(!props.url)
  const [view, setView] = useState<PanelView>('picker')
  const mergeHistoryRef = useRef(false)

  const updateNode = (change: (node: DynamicNode) => void) => {
    editor.update(
      () => {
        const node = $getNodeByKey(props.nodeKey)
        if ($isDynamicNode(node)) change(node)
      },
      mergeHistoryRef.current ? { tag: HISTORY_MERGE_TAG } : undefined,
    )
    mergeHistoryRef.current = true
  }

  const removeNode = () => {
    editor.update(() => {
      $getNodeByKey(props.nodeKey)?.remove()
    })
  }

  const openPanel = (next: boolean) => {
    if (next) setView(props.url ? (resolved ? 'props' : 'manual') : 'picker')
    else mergeHistoryRef.current = false
    setOpen(next)
  }

  const entry = resolved?.entry

  return (
    <div className="group/dynamic relative my-5">
      {props.url ? (
        <DynamicHostRenderer
          componentProps={props.componentProps}
          initialHeight={props.initialHeight}
          url={props.url}
        />
      ) : (
        <div
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-accent/40 bg-accent-soft text-sm text-accent"
          style={{ minHeight: Math.min(props.initialHeight, 160) }}
        >
          <Boxes aria-hidden="true" className="size-4" />
          {t('dynamicNode.placeholder')}
        </div>
      )}
      <Popover onOpenChange={openPanel} open={open}>
        <Popover.Trigger
          aria-label={t('dynamicNode.settings')}
          className={cn(
            'absolute right-2 top-2 flex size-7 items-center justify-center rounded-sm border border-border bg-surface-overlay text-fg-muted shadow-xs transition-opacity hover:text-fg focus-visible:opacity-100',
            props.url && !open && 'opacity-0 group-hover/dynamic:opacity-100',
          )}
          type="button"
        >
          <Settings2 aria-hidden="true" className="size-3.5" />
        </Popover.Trigger>
        <Popover.Content
          align="end"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !props.url) {
              event.preventDefault()
              removeNode()
            }
          }}
          width="xl"
        >
          {view === 'picker' ? (
            <CatalogPicker
              entries={
                catalog ? currentCatalogEntries(catalog.components) : null
              }
              onManual={() => setView('manual')}
              onPick={(picked) => {
                updateNode((node) => $applyCatalogEntry(node, picked))
                setView('props')
              }}
            />
          ) : view === 'manual' || !entry ? (
            <ManualDynamicForm
              initialHeight={props.initialHeight}
              onApply={(value) => {
                updateNode((node) => {
                  node.setUrl(value.url)
                  node.setInitialHeight(value.initialHeight)
                  node.setProps(value.props)
                })
                openPanel(false)
              }}
              onBack={() => setView('picker')}
              onRemove={removeNode}
              props={props.componentProps}
              url={props.url}
            />
          ) : (
            <div className="grid">
              <div className="flex items-center gap-2 border-b border-border px-2 py-2">
                <Button
                  aria-label={t('dynamicNode.backToPicker')}
                  className="h-7 px-1.5"
                  onClick={() => setView('picker')}
                  type="button"
                  variant="ghost"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </Button>
                <span className="truncate text-sm font-medium text-fg">
                  {entry.name}
                </span>
                {resolved.outdated ? (
                  <span
                    className="rounded-full bg-surface-inset px-2 py-0.5 text-xs text-fg-muted"
                    title={t('dynamicNode.outdatedHint')}
                  >
                    {t('dynamicNode.outdated')}
                  </span>
                ) : null}
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-3">
                <PropsEditor
                  key={entry.url}
                  onChange={(next) => updateNode((node) => node.setProps(next))}
                  schema={entry.propsSchema}
                  value={props.componentProps}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <span className="text-xs text-fg-muted">
                  {t('dynamicNode.liveHint')}
                </span>
                <div className="flex gap-2">
                  <Button
                    className="text-red-600 dark:text-red-400"
                    onClick={removeNode}
                    type="button"
                    variant="subtle"
                  >
                    {t('dynamicNode.remove')}
                  </Button>
                  <Button onClick={() => openPanel(false)} type="button">
                    {t('dynamicNode.done')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover>
    </div>
  )
}

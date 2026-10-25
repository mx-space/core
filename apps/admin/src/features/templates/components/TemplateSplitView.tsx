import {
  Group as PanelGroup,
  Panel,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels'

import { useI18n } from '~/i18n'
import { ResizeHandle } from '~/ui/layout/resize-handle'

import {
  TEMPLATE_EDITOR_PANEL_ID,
  TEMPLATE_PANE_MIN_SIZE,
  TEMPLATE_PREVIEW_PANEL_ID,
  TEMPLATE_SPLIT_DEFAULT,
  TEMPLATE_SPLIT_STORAGE_ID,
} from '../constants'
import { TemplateCodeEditor } from './TemplateCodeEditor'
import { TemplatePreview } from './TemplatePreview'

interface TemplateSplitViewProps {
  dirty: boolean
  error: string
  html: string
  onChangeSource: (value: string) => void
  onSave: () => void
  propsKeys: string[]
  saving: boolean
  source: string
}

/**
 * Editor | preview split. Draggable and persisted per browser; the preview
 * scales itself below 620px, so a narrow pane never hides part of the email.
 */
export function TemplateSplitView(props: TemplateSplitViewProps) {
  const { t } = useI18n()
  const editorRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: TEMPLATE_SPLIT_STORAGE_ID,
    panelIds: [TEMPLATE_EDITOR_PANEL_ID, TEMPLATE_PREVIEW_PANEL_ID],
  })

  return (
    <PanelGroup
      className="flex min-h-0 min-w-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      orientation="horizontal"
    >
      <Panel
        className="min-h-0 min-w-0"
        id={TEMPLATE_EDITOR_PANEL_ID}
        minSize={TEMPLATE_PANE_MIN_SIZE}
        panelRef={editorRef}
      >
        <TemplateCodeEditor
          dirty={props.dirty}
          onChange={props.onChangeSource}
          onSave={props.onSave}
          propsKeys={props.propsKeys}
          saving={props.saving}
          value={props.source}
        />
      </Panel>
      <ResizeHandle
        aria-label={t('templates.split.aria')}
        className="after:bg-neutral-300 after:opacity-100 dark:after:bg-neutral-700"
        disableDoubleClick
        // Double-click resets to the default split; `useDefaultLayout`
        // persists the resulting layout like any other change.
        onDoubleClick={() => editorRef.current?.resize(TEMPLATE_SPLIT_DEFAULT)}
      />
      <Panel
        className="min-h-0 min-w-0"
        id={TEMPLATE_PREVIEW_PANEL_ID}
        minSize={TEMPLATE_PANE_MIN_SIZE}
      >
        <TemplatePreview error={props.error} html={props.html} />
      </Panel>
    </PanelGroup>
  )
}

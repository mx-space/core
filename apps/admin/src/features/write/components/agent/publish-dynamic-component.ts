import type { AgentStore, ToolCallGroupItem } from '@haklex/rich-agent-core'
import {
  $isDynamicNode,
  INSERT_DYNAMIC_COMMAND,
} from '@haklex/rich-ext-dynamic'
import type { LexicalEditor } from 'lexical'

import { uploadFile } from '~/api/files'
import { translate } from '~/i18n/translate'
import { $findBlockByBlockId } from '~/vendor/rich-editor/utils/apply-agent-review-batch'
import {
  registerDynamicComponent,
  resolveCatalogUrl,
  reviseDynamicComponent,
} from '~/vendor/rich-editor/utils/dynamic-catalog'
import {
  isSameDynamicTarget,
  readDynamicDraft,
  readDynamicReceipt,
  readDynamicTarget,
} from '~/vendor/rich-editor/utils/dynamic-tools'

export function createDynamicPublisher(
  store: AgentStore,
  getEditor: () => LexicalEditor | null,
) {
  // ponytail: serialize this editor's catalog updates; use a server-side atomic
  // append if simultaneous adoption across multiple admins becomes necessary.
  let publishing = false
  return async (item: ToolCallGroupItem) => {
    if (publishing) throw new Error(translate('write.agent.dynamic.busy'))
    const draft = readDynamicDraft(item)
    const editor = getEditor()
    const findCurrent = () =>
      store
        .getState()
        .bubbles.flatMap((bubble) =>
          bubble.type === 'tool_call_group' ? bubble.items : [],
        )
        .find(
          (current) => current.id === item.id && current.params === item.params,
        )
    const assertCurrent = () => {
      if (
        !editor ||
        editor !== getEditor() ||
        !findCurrent() ||
        !['idle', 'done'].includes(store.getState().status)
      ) {
        throw new Error(translate('write.agent.dynamic.contextChanged'))
      }
    }
    assertCurrent()
    if (!draft || !editor)
      throw new Error(translate('write.agent.dynamic.invalidDraft'))
    const receipt = readDynamicReceipt(findCurrent()!)
    if (receipt.inserted) return
    const saveReceipt = (url: string, inserted: boolean) => {
      store.setState((state) => ({
        bubbles: state.bubbles.map((bubble) =>
          bubble.type === 'tool_call_group'
            ? {
                ...bubble,
                items: bubble.items.map((current) =>
                  current.id === item.id
                    ? {
                        ...current,
                        result: JSON.stringify({ draft, url, inserted }),
                      }
                    : current,
                ),
              }
            : bubble,
        ),
      }))
    }
    const assertTarget = () => {
      if (
        draft.target &&
        !isSameDynamicTarget(
          readDynamicTarget(editor, draft.target.blockId),
          draft.target,
        )
      ) {
        throw new Error(translate('write.agent.dynamic.targetChanged'))
      }
    }
    assertTarget()
    publishing = true
    try {
      const url =
        receipt.url ??
        (
          await uploadFile(
            new File([draft.source], `widget-${crypto.randomUUID()}.js`, {
              type: 'text/javascript',
            }),
            'file',
            { immutable: true },
          )
        ).url
      assertCurrent()
      saveReceipt(url, false)
      const resolved = draft.target
        ? await resolveCatalogUrl(draft.target.url)
        : null
      const parent = resolved?.entry
      const alreadyCataloged = parent?.url === url
      if (!alreadyCataloged && parent?.id && !resolved?.outdated) {
        await reviseDynamicComponent(
          { ...parent, id: parent.id },
          {
            url,
            parentUrl: parent.url,
            initialHeight: draft.initialHeight,
            ...(draft.description ? { description: draft.description } : {}),
            ...(draft.propsSchema ? { propsSchema: draft.propsSchema } : {}),
          },
        )
      } else if (!alreadyCataloged) {
        await registerDynamicComponent({
          parentUrl: draft.target?.url,
          name: draft.name,
          description: draft.description || parent?.description || draft.name,
          url,
          initialHeight: draft.initialHeight,
          propsSchema: draft.propsSchema ?? parent?.propsSchema ?? {},
        })
      }
      assertCurrent()
      assertTarget()
      if (draft.target) {
        editor.update(
          () => {
            const node = $findBlockByBlockId(draft.target!.blockId)
            if (!$isDynamicNode(node))
              throw new Error(translate('write.agent.dynamic.targetChanged'))
            node.setUrl(url)
            node.setProps(draft.props)
            node.setInitialHeight(draft.initialHeight)
          },
          { discrete: true },
        )
      } else if (
        !editor.dispatchCommand(INSERT_DYNAMIC_COMMAND, {
          url,
          props: draft.props,
          initialHeight: draft.initialHeight,
        })
      ) {
        throw new Error(translate('write.agent.editorNotReady'))
      }
      saveReceipt(url, true)
    } finally {
      publishing = false
    }
  }
}

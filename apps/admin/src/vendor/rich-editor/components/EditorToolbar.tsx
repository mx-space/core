import { Menu } from '@base-ui/react/menu'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Pilcrow,
  Redo,
  Strikethrough,
  Type,
  Underline,
  Undo,
} from 'lucide-react'
import { useMemo } from 'react'
import {
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import type { BlockType } from '@haklex/rich-plugin-toolbar'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import {
  $toggleSpoilerSelection,
  collectCommandItems,
} from '@haklex/rich-editor/commands'
import {
  applyBlockType,
  applyFontFamily,
  FONT_FAMILIES,
  getFontLabel,
  useToolbarState,
} from '@haklex/rich-plugin-toolbar'

import { cn } from '~/utils/cn'

const MAX_INLINE_INSERT_ITEMS = 5

interface BlockOption {
  type: BlockType
  label: string
  icon: LucideIcon
}

const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'paragraph', label: '正文', icon: Pilcrow },
  { type: 'h1', label: '标题 1', icon: Heading1 },
  { type: 'h2', label: '标题 2', icon: Heading2 },
  { type: 'h3', label: '标题 3', icon: Heading3 },
]

const ALIGN_OPTIONS: Array<{
  format: 'left' | 'center' | 'right' | 'justify'
  label: string
  icon: LucideIcon
}> = [
  { format: 'left', label: '左对齐', icon: AlignLeft },
  { format: 'center', label: '居中', icon: AlignCenter },
  { format: 'right', label: '右对齐', icon: AlignRight },
  { format: 'justify', label: '两端对齐', icon: AlignJustify },
]

export function EditorToolbar(props: { className?: string }) {
  const [editor] = useLexicalComposerContext()
  const state = useToolbarState()
  const activeBlock =
    BLOCK_OPTIONS.find((option) => option.type === state.blockType) ??
    BLOCK_OPTIONS[0]
  const ActiveBlockIcon = activeBlock.icon

  const insertItems = useMemo(
    () =>
      collectCommandItems(editor).filter(
        (item) =>
          item.placement?.includes('toolbar') && item.group === 'insert',
      ),
    [editor],
  )
  const inlineInsertItems = insertItems.slice(0, MAX_INLINE_INSERT_ITEMS)
  const overflowInsertItems = insertItems.slice(MAX_INLINE_INSERT_ITEMS)

  return (
    <div
      aria-label="编辑器工具栏"
      className={cn(
        'sticky top-0 z-10 flex w-full items-center gap-0.5 overflow-x-auto border-b border-neutral-200 bg-white/85 px-2 py-1.5 backdrop-blur dark:border-neutral-900 dark:bg-neutral-950/85',
        props.className,
      )}
      role="toolbar"
    >
      <FontFamilyMenu activeValue={state.fontFamily} editor={editor} />

      <ToolbarDivider />

      <BlockMenu activeIcon={ActiveBlockIcon} label={activeBlock.label}>
        {BLOCK_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <ToolbarMenuItem
              key={option.type}
              active={state.blockType === option.type}
              onClick={() => applyBlockType(editor, option.type)}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {option.label}
            </ToolbarMenuItem>
          )
        })}
      </BlockMenu>

      <ToolbarDivider />

      <ToolbarIconButton
        disabled={!state.canUndo}
        icon={Undo}
        label="撤销"
        shortcut="⌘Z"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      />
      <ToolbarIconButton
        disabled={!state.canRedo}
        icon={Redo}
        label="重做"
        shortcut="⌘⇧Z"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      />

      <ToolbarDivider />

      <ToolbarIconButton
        active={state.isBold}
        icon={Bold}
        label="粗体"
        shortcut="⌘B"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      />
      <ToolbarIconButton
        active={state.isItalic}
        icon={Italic}
        label="斜体"
        shortcut="⌘I"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      />
      <ToolbarIconButton
        active={state.isUnderline}
        icon={Underline}
        label="下划"
        shortcut="⌘U"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      />
      <ToolbarIconButton
        active={state.isStrikethrough}
        icon={Strikethrough}
        label="删除线"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }
      />
      <ToolbarIconButton
        active={state.isCode}
        icon={Code}
        label="行内代码"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      />

      <ToolbarDivider />

      <ToolbarIconButton
        active={state.isHighlight}
        icon={Highlighter}
        label="高亮"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight')}
      />
      <ToolbarIconButton
        active={state.isSpoiler}
        icon={EyeOff}
        label="剧透遮罩"
        onClick={() => editor.update($toggleSpoilerSelection)}
      />

      <ToolbarDivider />

      <ToolbarIconButton
        active={state.blockType === 'bullet'}
        icon={List}
        label="无序列表"
        onClick={() => applyBlockType(editor, 'bullet')}
      />
      <ToolbarIconButton
        active={state.blockType === 'number'}
        icon={ListOrdered}
        label="有序列表"
        onClick={() => applyBlockType(editor, 'number')}
      />
      <ToolbarIconButton
        active={state.blockType === 'check'}
        icon={ListChecks}
        label="待办列表"
        onClick={() => applyBlockType(editor, 'check')}
      />

      <ToolbarDivider />

      {ALIGN_OPTIONS.map((option) => (
        <ToolbarIconButton
          key={option.format}
          active={
            state.elementFormat === option.format ||
            (option.format === 'left' && state.elementFormat === '')
          }
          icon={option.icon}
          label={option.label}
          onClick={() =>
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, option.format)
          }
        />
      ))}

      {insertItems.length > 0 ? (
        <>
          <ToolbarDivider />
          {inlineInsertItems.map((item) => (
            <ToolbarIconButton
              key={item.title}
              icon={null}
              iconNode={item.icon}
              label={item.title}
              shortcut={item.shortcut}
              onClick={() => item.onSelect(editor, '')}
            />
          ))}
          {overflowInsertItems.length > 0 ? (
            <InsertOverflowMenu
              items={overflowInsertItems.map((item) => ({
                icon: item.icon,
                label: item.title,
                onClick: () => item.onSelect(editor, ''),
              }))}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function ToolbarIconButton(props: {
  active?: boolean
  disabled?: boolean
  icon: LucideIcon | null
  iconNode?: ReactNode
  label: string
  shortcut?: string
  onClick: () => void
}) {
  const Icon = props.icon
  return (
    <button
      aria-label={props.label}
      aria-pressed={props.active}
      className={cn(
        'focus-visible:outline-hidden inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100',
        props.active &&
          'bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50',
      )}
      disabled={props.disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        props.onClick()
      }}
      title={
        props.shortcut ? `${props.label} (${props.shortcut})` : props.label
      }
      type="button"
    >
      {Icon ? (
        <Icon aria-hidden="true" className="size-3.5" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 items-center justify-center [&>svg]:size-3.5"
        >
          {props.iconNode}
        </span>
      )}
    </button>
  )
}

function ToolbarDivider() {
  return (
    <div
      aria-hidden="true"
      className="mx-1 h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800"
    />
  )
}

function BlockMenu(props: {
  activeIcon: LucideIcon
  label: string
  children: ReactNode
}) {
  const Icon = props.activeIcon
  return (
    <Menu.Root>
      <Menu.Trigger
        className="focus-visible:outline-hidden inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        type="button"
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{props.label}</span>
        <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={6}>
          <Menu.Popup className="outline-hidden z-50 min-w-40 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            {props.children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function FontFamilyMenu(props: {
  activeValue: string
  editor: ReturnType<typeof useLexicalComposerContext>[0]
}) {
  const label = getFontLabel(props.activeValue)
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="字体"
        className="focus-visible:outline-hidden inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        title="字体"
        type="button"
      >
        <Type aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={6}>
          <Menu.Popup className="outline-hidden z-50 min-w-32 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            {FONT_FAMILIES.map((def) => {
              const style: CSSProperties | undefined = def.value
                ? { fontFamily: def.value }
                : undefined
              return (
                <ToolbarMenuItem
                  key={def.label}
                  active={props.activeValue === def.value}
                  onClick={() => applyFontFamily(props.editor, def.value)}
                >
                  <span style={style}>{def.label}</span>
                </ToolbarMenuItem>
              )
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ToolbarMenuItem(props: {
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Menu.Item
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 outline-none transition-colors hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:data-[highlighted]:bg-neutral-900',
        props.active && 'text-neutral-950 dark:text-neutral-50',
      )}
      onClick={props.onClick}
    >
      {props.children}
    </Menu.Item>
  )
}

function InsertOverflowMenu(props: {
  items: Array<{ icon?: ReactNode; label: string; onClick: () => void }>
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="更多插入"
        className="focus-visible:outline-hidden inline-flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        title="更多"
        type="button"
      >
        <MoreHorizontal aria-hidden="true" className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" side="bottom" sideOffset={6}>
          <Menu.Popup className="outline-hidden z-50 min-w-44 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            {props.items.map((item) => (
              <ToolbarMenuItem key={item.label} onClick={item.onClick}>
                {item.icon ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-3.5 shrink-0 items-center justify-center [&>svg]:size-3.5"
                  >
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </ToolbarMenuItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

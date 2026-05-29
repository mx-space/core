import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'

import { useSlashMenu } from './use-slash-menu'

import './slash-menu.css'

interface SlashMenuProps {
  editorView: EditorView | undefined
}

export function SlashMenu({ editorView }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const {
    isOpen,
    position,
    query,
    groupedItems,
    flatItems,
    activeIndex,
    isKeyboardNav,
    setActiveIndex,
    setIsKeyboardNav,
    executeItem,
    closeMenu,
  } = useSlashMenu(editorView)

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (!isOpen) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [isOpen, closeMenu])

  useLayoutEffect(() => {
    if (!isOpen || flatItems.length === 0) return
    const activeItem = flatItems[activeIndex]
    if (!activeItem) return
    const el = itemRefs.current.get(activeItem.id)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex, isOpen, flatItems])

  if (!isOpen || !position) return null
  if (typeof document === 'undefined') return null

  const overlay = (
    <div
      ref={menuRef}
      className="slash-menu fixed z-[70] flex max-h-[380px] min-w-[260px] max-w-[320px] flex-col overflow-hidden rounded-xl border border-neutral-200/60 bg-white/95 shadow-xl shadow-neutral-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-neutral-700/60 dark:bg-neutral-900/95 dark:shadow-neutral-950/50"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => {
        if (isKeyboardNav) setIsKeyboardNav(false)
      }}
    >
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          命令
        </span>
        {query && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            /{query}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-1.5">
        {flatItems.length === 0 && (
          <div className="px-3 py-6 text-center">
            <span className="text-sm text-neutral-400 dark:text-neutral-500">
              未找到匹配命令
            </span>
          </div>
        )}

        {groupedItems.map((group, groupIndex) => (
          <div
            key={group.id}
            className={
              groupIndex > 0
                ? 'mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800'
                : ''
            }
          >
            <div className="px-2 py-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const index = flatItems.findIndex((e) => e.id === item.id)
                const isActive = index === activeIndex
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el)
                    }}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => {
                      if (isKeyboardNav) return
                      if (index >= 0) setActiveIndex(index)
                    }}
                    className={`slash-menu-item relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-100 ${
                      isActive
                        ? 'bg-neutral-100 dark:bg-neutral-800'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    {isActive && (
                      <div className="bg-primary absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" />
                    )}
                    <div
                      className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? 'bg-white shadow-sm dark:bg-neutral-700'
                          : 'bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      {Icon && (
                        <Icon
                          width={16}
                          height={16}
                          strokeWidth={2}
                          className={
                            isActive
                              ? 'text-primary'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm font-medium ${
                          isActive
                            ? 'text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center justify-center gap-3 border-t border-neutral-100 px-3 py-2 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800">
            ↑↓
          </kbd>
          <span>导航</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800">
            ↵
          </kbd>
          <span>选择</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800">
            Esc
          </kbd>
          <span>关闭</span>
        </span>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

import { css, html, LitElement } from 'lit'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import type { Range, Text } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'

import { history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import {
  Annotation,
  Compartment,
  EditorState,
  Prec,
  StateField,
} from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, EditorView, keymap, WidgetType } from '@codemirror/view'
import { githubLight } from '@ddietr/codemirror-themes/theme/github-light'

import { languageSvgIcons } from '../language-icons'
import { blockDetectorFacet, isHiddenSeparatorLine } from './block-registry'

const codeBlockStartRegex = /^```(?!`)(.*)$/
const codeBlockEndRegex = /^```\s*$/
const codeBlockLanguageRegex = /^[\w#+.-]+$/
const codeBlockTagName = 'cm-wysiwyg-codeblock'

// Language alias mapping - maps shorthand to canonical name
const languageAliasMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript', // TSX uses TypeScript icon
  jsx: 'javascript', // JSX uses JavaScript icon
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  rs: 'rust',
  kt: 'kotlin',
  pl: 'perl',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  sc: 'scala',
  vue: 'vue',
  svelte: 'svelte',
  gql: 'graphql',
  sql: 'sql',
  pgsql: 'sql',
  mysql: 'sql',
  postgres: 'sql',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
}

// Display name mapping for better UI labels
const languageDisplayNames: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript React',
  jsx: 'JavaScript React',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  sql: 'SQL',
  bash: 'Bash',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
  vue: 'Vue',
  react: 'React',
  lua: 'Lua',
  perl: 'Perl',
  r: 'R',
  scala: 'Scala',
  haskell: 'Haskell',
  elixir: 'Elixir',
  clojure: 'Clojure',
  dart: 'Dart',
  svelte: 'Svelte',
}

// Plain text file icon SVG
const plainTextIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`

// Get the canonical language key for icon lookup
const getCanonicalLanguage = (lang: string): string => {
  const lower = lang.toLowerCase()
  return languageAliasMap[lower] || lower
}

// Get SVG icon for a language, returns plainTextIcon as fallback
const getLanguageSvg = (lang: string): string => {
  const canonical = getCanonicalLanguage(lang)
  return languageSvgIcons[canonical] || plainTextIcon
}

// Get display name for a language
const getLanguageDisplayName = (lang: string): string => {
  const lower = lang.toLowerCase()
  // First check if it has a specific display name (like tsx -> "TypeScript React")
  if (languageDisplayNames[lower]) {
    return languageDisplayNames[lower]
  }
  // Then check canonical name
  const canonical = getCanonicalLanguage(lower)
  if (languageDisplayNames[canonical]) {
    return languageDisplayNames[canonical]
  }
  // Fallback to capitalized version
  return lang.charAt(0).toUpperCase() + lang.slice(1)
}

// Common languages for the dropdown
const popularLanguages = Object.keys(languageSvgIcons)

const parseCodeBlockLanguage = (info: string): string => {
  if (!info) return ''
  const [firstToken] = info.trim().split(/\s+/)
  if (!firstToken) return ''
  return codeBlockLanguageRegex.test(firstToken) ? firstToken : ''
}

const findLanguageDescription = (
  language: string,
): LanguageDescription | null => {
  if (!language) return null
  const normalized = languageAliasMap[language] || language
  return LanguageDescription.matchLanguageName(languages, normalized, true)
}

class CodeBlockElement extends LitElement {
  static properties = {
    code: { type: String },
    language: { type: String },
    isDark: { type: Boolean },
    isDropdownOpen: { type: Boolean, state: true },
    searchQuery: { type: String, state: true },
    highlightedIndex: { type: Number, state: true },
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      margin: 0.5rem 0;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .codeblock-header {
      display: flex;
      align-items: center;
      height: 40px;

      background-color: color-mix(in srgb, currentColor 6%, transparent);
      border-bottom: 1px solid color-mix(in srgb, currentColor 8%, transparent);
    }

    .codeblock-lang-selector {
      /* Reset button styles */
      appearance: none;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      /* Layout */
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 28px;
      padding: 0 4px;
      margin: 0 4px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s cubic-bezier(0.33, 1, 0.68, 1); /* ease-out */
      user-select: none;
    }

    .codeblock-lang-selector:hover {
      background-color: color-mix(in srgb, currentColor 8%, transparent);
    }

    .codeblock-lang-selector:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--primary-color, #3b82f6);
    }

    .codeblock-lang-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .codeblock-lang-icon svg {
      width: 100%;
      height: 100%;
    }

    .codeblock-lang-name {
      font-family: var(
        --font-sans,
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        Roboto,
        sans-serif
      );
      font-size: 12px; /* text-xs */
      font-weight: 500;
    }

    .codeblock-lang-chevron {
      color: currentColor;
      opacity: 0.5;
      font-size: 10px;
      transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1); /* ease-spring */
      transform-origin: center;
    }

    .codeblock-lang-chevron.open {
      transform: rotate(180deg);
    }

    /* Reduced motion preference */
    @media (prefers-reduced-motion: reduce) {
      .codeblock-lang-selector,
      .codeblock-lang-chevron {
        transition-duration: 0.01ms !important;
      }
    }

    .codeblock-area {
      display: flex;
      background-color: color-mix(in srgb, currentColor 5%, transparent);
    }

    .codeblock-editor {
      display: block;
      width: 100%;
    }

    /* Force CodeMirror to use auto height instead of full height */
    .codeblock-editor .cm-editor {
      height: auto !important;
      background: transparent;
    }

    .codeblock-editor .cm-gutters {
      display: none;
    }

    .codeblock-editor .cm-scroller {
      font-family:
        ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
        'Liberation Mono', monospace;
      font-size: 0.9em;
      line-height: 1.5;
      padding: 0;
      overflow: auto;
      background: transparent;
      /* Reset any inherited height */
      min-height: auto !important;
    }

    .codeblock-editor .cm-content {
      padding: 0.75rem;
      box-sizing: border-box;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      white-space: pre;
      tab-size: 2;
      /* Reset max-width and margin from outer editor */
      max-width: none !important;
      margin: 0 !important;
    }

    .codeblock-editor .cm-content .cm-line {
      margin: 0 !important;
      padding: 0;
    }

    .codeblock-editor .cm-focused {
      outline: none;
    }
  `

  declare code: string
  declare language: string
  declare isDark: boolean
  declare isDropdownOpen: boolean
  declare searchQuery: string
  declare highlightedIndex: number

  enterPos = 0
  contentFrom = 0
  private dropdownEl?: HTMLElement
  private backdropEl?: HTMLElement
  private dropdownStyleEl?: HTMLStyleElement
  contentTo = 0
  blockStart = 0
  blockEnd = 0
  outerView?: EditorView

  private innerView?: EditorView
  private syncingFromOuter = false
  private languageCompartment = new Compartment()
  private themeCompartment = new Compartment()
  private languageLoadId = 0
  private resizeObserver?: ResizeObserver
  private measureScheduled = false

  constructor() {
    super()
    this.code = ''
    this.language = ''
    this.isDark = false
    this.isDropdownOpen = false
    this.searchQuery = ''
    this.highlightedIndex = 0
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.classList.add('cm-wysiwyg-codeblock')
  }

  private get filteredLanguages(): string[] {
    const query = this.searchQuery.toLowerCase().trim()
    if (!query) return popularLanguages
    return popularLanguages.filter((lang) => lang.toLowerCase().includes(query))
  }

  private get showCustomOption(): boolean {
    const query = this.searchQuery.trim()
    if (!query) return false
    const queryLower = query.toLowerCase()
    return (
      codeBlockLanguageRegex.test(query) &&
      !popularLanguages.some((lang) => lang.toLowerCase() === queryLower)
    )
  }

  render(): ReturnType<typeof html> {
    const langSvg = getLanguageSvg(this.language || 'plaintext')
    const displayName = this.language
      ? getLanguageDisplayName(this.language)
      : 'Plain Text'

    return html`
      <div class="codeblock-header">
        <button
          class="codeblock-lang-selector"
          type="button"
          aria-haspopup="listbox"
          aria-expanded="${this.isDropdownOpen}"
          aria-label="选择代码语言: ${displayName}"
          @click=${this.handleLangClick}
          @keydown=${this.handleSelectorKeydown}
        >
          <span class="codeblock-lang-icon">${unsafeHTML(langSvg)}</span>
          <span class="codeblock-lang-name">${displayName}</span>
          <span
            class="codeblock-lang-chevron ${this.isDropdownOpen ? 'open' : ''}"
            >▾</span
          >
        </button>
      </div>
      <div class="codeblock-area">
        <div class="codeblock-editor"></div>
      </div>
    `
  }

  firstUpdated(): void {
    const editorHost = this.shadowRoot?.querySelector(
      '.codeblock-editor',
    ) as HTMLElement | null
    if (editorHost) {
      this.createInnerEditor(editorHost)
    }
    this.addEventListener('mousedown', this.handleMouseDown)

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleOuterMeasure()
      })
      this.resizeObserver.observe(this)
    }
    this.scheduleOuterMeasure()
  }

  updated(changed: Map<string, unknown>): void {
    if (!this.innerView) {
      const editorHost = this.shadowRoot?.querySelector(
        '.codeblock-editor',
      ) as HTMLElement | null
      if (editorHost) {
        this.createInnerEditor(editorHost)
      }
    }

    if (changed.has('code')) {
      this.syncInnerDoc()
    }

    if (changed.has('language')) {
      this.applyLanguage()
    }

    if (changed.has('isDark')) {
      this.applyTheme()
    }
  }

  disconnectedCallback(): void {
    this.removeEventListener('mousedown', this.handleMouseDown)
    // Restore page scroll if dropdown was open
    if (this.isDropdownOpen) {
      document.body.style.overflow = ''
    }
    this.removeDropdownPortal()
    this.innerView?.dom.removeEventListener('focusin', this.handleFocus)
    this.innerView?.destroy()
    this.innerView = undefined
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = undefined
    }
    super.disconnectedCallback()
  }

  focusEditor(position: 'start' | 'end' = 'start'): void {
    const focus = () => {
      if (!this.innerView) return
      const docLength = this.innerView.state.doc.length
      const anchor = position === 'end' ? docLength : 0
      this.innerView.dispatch({ selection: { anchor } })
      this.innerView.focus()
    }

    if (this.innerView) {
      focus()
      return
    }

    void this.updateComplete.then(focus)
  }

  private createInnerEditor(host: HTMLElement): void {
    if (this.innerView) return

    const boundaryKeymap = Prec.highest(
      keymap.of([
        {
          key: 'ArrowUp',
          run: () => this.exitIfAtBoundary('up'),
        },
        {
          key: 'ArrowDown',
          run: () => this.exitIfAtBoundary('down'),
        },
      ]),
    )

    // Base theme to force auto height (overrides inherited styles)
    const codeBlockBaseTheme = EditorView.theme({
      '&': {
        height: 'auto',
      },
      '.cm-scroller': {
        minHeight: 'auto',
      },
      '.cm-content': {
        maxWidth: 'none',
        margin: '0',
      },
      '.cm-line': {
        margin: '0',
      },
    })

    const state = EditorState.create({
      doc: this.code,
      extensions: [
        boundaryKeymap,
        codeBlockBaseTheme,
        history(),
        keymap.of([...historyKeymap, indentWithTab]),
        EditorState.tabSize.of(2),
        this.languageCompartment.of([]),
        this.themeCompartment.of(this.isDark ? oneDark : githubLight),
        EditorView.contentAttributes.of({
          spellcheck: 'false',
          autocapitalize: 'off',
          autocomplete: 'off',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || this.syncingFromOuter) return
          this.syncOuterDoc(update.state.doc.toString())
        }),
      ],
    })

    this.innerView = new EditorView({ state, parent: host })
    this.innerView.dom.addEventListener('focusin', this.handleFocus)
    this.applyLanguage()
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    // Check if click is inside the editor area (in shadow DOM)
    const path = event.composedPath()
    const editorHost = this.shadowRoot?.querySelector('.codeblock-editor')
    if (editorHost && path.includes(editorHost)) {
      if (!this.innerView?.hasFocus) {
        this.innerView?.focus()
      }
      return
    }
    // Don't interfere with lang editing
    const langArea = this.shadowRoot?.querySelector('.codeblock-lang')
    if (langArea && path.includes(langArea)) {
      return
    }
    event.preventDefault()
    this.innerView?.focus()
  }

  handleLangClick = (): void => {
    if (this.isDropdownOpen) {
      this.closeDropdown()
      return
    }
    this.openDropdown()
  }

  handleSelectorKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.handleLangClick()
    }
    if (event.key === 'ArrowDown' && !this.isDropdownOpen) {
      event.preventDefault()
      this.openDropdown()
    }
  }

  private openDropdown(): void {
    this.isDropdownOpen = true
    this.searchQuery = ''
    this.highlightedIndex = 0
    this.createDropdownPortal()
    // Lock page scroll (modal behavior)
    document.body.style.overflow = 'hidden'
  }

  private closeDropdown(): void {
    if (!this.isDropdownOpen) return
    this.isDropdownOpen = false
    this.searchQuery = ''
    this.highlightedIndex = 0
    this.removeDropdownPortal()
    // Restore page scroll
    document.body.style.overflow = ''
  }

  private createDropdownPortal(): void {
    // Inject styles if not already done
    if (!this.dropdownStyleEl) {
      this.dropdownStyleEl = document.createElement('style')
      this.dropdownStyleEl.textContent = `
        /* Dropdown entry animation */
        @keyframes dropdown-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Modal backdrop */
        .cm-codeblock-dropdown-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
        }

        .cm-codeblock-dropdown {
          position: fixed;
          z-index: 10000;
          min-width: 180px;
          max-width: 240px;
          background: #171717; /* neutral-900 */
          border: none;
          border-radius: 8px;
          /* Vercel-style shadow for dark mode (shadow simulates border) */
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.08),
            0 8px 24px rgba(0, 0, 0, 0.5),
            0 16px 32px rgba(0, 0, 0, 0.4);
          max-height: 280px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          font-size: 14px; /* text-sm */
          color: #fafafa; /* neutral-50 */
          /* Entry animation */
          animation: dropdown-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1); /* ease-spring */
          transform-origin: top left;
        }
        .cm-codeblock-dropdown.light {
          background: #fff;
          color: #171717; /* neutral-900 */
          /* Vercel-style shadow for light mode */
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.08),
            0 8px 24px rgba(0, 0, 0, 0.12),
            0 16px 32px rgba(0, 0, 0, 0.08);
        }
        .cm-codeblock-dropdown-search {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-search {
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }
        .cm-codeblock-dropdown-input {
          width: 100%;
          height: 32px;
          padding: 0 10px;
          font-family: inherit;
          font-size: 12px; /* text-xs */
          color: inherit;
          background: transparent;
          border: none;
          border-radius: 0;
          outline: none;
          box-sizing: border-box;
        }
        .cm-codeblock-dropdown-input::placeholder {
          color: #737373; /* neutral-500 */
        }
        .cm-codeblock-dropdown-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px;
        }
        .cm-codeblock-dropdown-list::-webkit-scrollbar {
          width: 6px;
        }
        .cm-codeblock-dropdown-list::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .cm-codeblock-dropdown-list::-webkit-scrollbar-thumb {
          background: #404040; /* neutral-700 */
          border-radius: 3px;
        }
        .cm-codeblock-dropdown-list::-webkit-scrollbar-thumb:hover {
          background: #525252; /* neutral-600 */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-list::-webkit-scrollbar-thumb {
          background: #d4d4d4; /* neutral-300 */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-list::-webkit-scrollbar-thumb:hover {
          background: #a3a3a3; /* neutral-400 */
        }
        .cm-codeblock-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 32px;
          padding: 0 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px; /* text-xs */
          transition: background-color 0.1s cubic-bezier(0.33, 1, 0.68, 1); /* ease-out */
        }
        .cm-codeblock-dropdown-item:hover,
        .cm-codeblock-dropdown-item.highlighted {
          background-color: #262626; /* neutral-800 */
          color: #fafafa; /* neutral-50 - ensure text visibility */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-item:hover,
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-item.highlighted {
          background-color: #f5f5f5; /* neutral-100 */
          color: #171717; /* neutral-900 */
        }
        .cm-codeblock-dropdown-item.selected {
          background-color: #262626; /* neutral-800 */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-item.selected {
          background-color: #f5f5f5; /* neutral-100 */
        }
        .cm-codeblock-dropdown-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .cm-codeblock-dropdown-icon svg {
          width: 100%;
          height: 100%;
        }
        .cm-codeblock-dropdown-name {
          flex: 1;
          font-weight: 450;
        }
        .cm-codeblock-dropdown-empty {
          padding: 16px 8px;
          text-align: center;
          color: #737373; /* neutral-500 */
          font-size: 12px; /* text-xs */
        }
        .cm-codeblock-dropdown-custom {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 32px;
          padding: 0 8px;
          margin: 4px;
          border-radius: 6px;
          border-top: 1px solid #262626; /* neutral-800 */
          cursor: pointer;
          color: #a3a3a3; /* neutral-400 */
          font-size: 12px; /* text-xs */
          transition: background-color 0.1s cubic-bezier(0.33, 1, 0.68, 1), color 0.1s cubic-bezier(0.33, 1, 0.68, 1); /* ease-out */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-custom {
          border-top-color: #e5e5e5; /* neutral-200 */
          color: #737373; /* neutral-500 */
        }
        .cm-codeblock-dropdown-custom:hover,
        .cm-codeblock-dropdown-custom.highlighted {
          background-color: #262626; /* neutral-800 */
          color: #fafafa; /* neutral-50 */
        }
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-custom:hover,
        .cm-codeblock-dropdown.light .cm-codeblock-dropdown-custom.highlighted {
          background-color: #f5f5f5; /* neutral-100 */
          color: #171717; /* neutral-900 */
        }

        /* Reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .cm-codeblock-dropdown {
            animation: none;
          }
          .cm-codeblock-dropdown-input,
          .cm-codeblock-dropdown-item,
          .cm-codeblock-dropdown-custom {
            transition-duration: 0.01ms !important;
          }
        }
      `
      document.head.appendChild(this.dropdownStyleEl)
    }

    // Create backdrop element (modal interaction pattern)
    this.backdropEl = document.createElement('div')
    this.backdropEl.className = 'cm-codeblock-dropdown-backdrop'
    this.backdropEl.addEventListener('click', this.handleBackdropClick)
    document.body.appendChild(this.backdropEl)

    // Create dropdown element
    this.dropdownEl = document.createElement('div')
    this.dropdownEl.className = `cm-codeblock-dropdown ${this.isDark ? '' : 'light'}`
    this.updateDropdownContent()
    this.positionDropdown()
    document.body.appendChild(this.dropdownEl)

    // Focus input after render
    requestAnimationFrame(() => {
      const input = this.dropdownEl?.querySelector(
        '.cm-codeblock-dropdown-input',
      ) as HTMLInputElement | null
      input?.focus()
    })
  }

  private handleBackdropClick = (): void => {
    this.closeDropdown()
  }

  private removeDropdownPortal(): void {
    if (this.backdropEl) {
      this.backdropEl.removeEventListener('click', this.handleBackdropClick)
      this.backdropEl.remove()
      this.backdropEl = undefined
    }
    if (this.dropdownEl) {
      this.dropdownEl.remove()
      this.dropdownEl = undefined
    }
  }

  private positionDropdown(): void {
    if (!this.dropdownEl) return
    const selector = this.shadowRoot?.querySelector('.codeblock-lang-selector')
    if (!selector) return

    const rect = selector.getBoundingClientRect()
    this.dropdownEl.style.left = `${rect.left}px`
    this.dropdownEl.style.top = `${rect.bottom + 4}px`
  }

  private updateDropdownContent(): void {
    if (!this.dropdownEl) return
    const filtered = this.filteredLanguages
    const showCustom = this.showCustomOption

    let listHtml = ''
    if (filtered.length > 0) {
      listHtml = filtered
        .map((lang, index) => {
          const svg = getLanguageSvg(lang)
          const displayName = getLanguageDisplayName(lang)
          const isSelected = lang === this.language
          const classes = [
            'cm-codeblock-dropdown-item',
            index === this.highlightedIndex ? 'highlighted' : '',
            isSelected ? 'selected' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return `
            <div
              class="${classes}"
              data-lang="${lang}"
              data-index="${index}"
              role="option"
              aria-selected="${isSelected}"
              tabindex="-1"
            >
              <span class="cm-codeblock-dropdown-icon">${svg}</span>
              <span class="cm-codeblock-dropdown-name">${displayName}</span>
            </div>
          `
        })
        .join('')
    } else if (!showCustom) {
      listHtml =
        '<div class="cm-codeblock-dropdown-empty">No matching languages</div>'
    }

    let customHtml = ''
    if (showCustom) {
      const customQuery = this.searchQuery.trim()
      const customSvg = getLanguageSvg(customQuery)
      const classes = [
        'cm-codeblock-dropdown-custom',
        this.highlightedIndex === filtered.length ? 'highlighted' : '',
      ]
        .filter(Boolean)
        .join(' ')
      customHtml = `
        <div
          class="${classes}"
          data-custom="true"
          role="option"
          aria-selected="false"
          tabindex="-1"
        >
          <span class="cm-codeblock-dropdown-icon">${customSvg}</span>
          <span class="cm-codeblock-dropdown-name">Use "${customQuery}"</span>
        </div>
      `
    }

    this.dropdownEl.innerHTML = `
      <div class="cm-codeblock-dropdown-search">
        <input
          class="cm-codeblock-dropdown-input"
          type="text"
          placeholder="Search languages…"
          aria-label="搜索编程语言"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="language-listbox"
          aria-expanded="true"
          value="${this.searchQuery}"
        />
      </div>
      <div class="cm-codeblock-dropdown-list" role="listbox" id="language-listbox">${listHtml}</div>
      ${customHtml}
    `

    // Attach event listeners
    const input = this.dropdownEl.querySelector(
      '.cm-codeblock-dropdown-input',
    ) as HTMLInputElement
    input?.addEventListener('input', this.handleSearchInputPortal)
    input?.addEventListener('keydown', this.handleDropdownKeydown)

    const items = this.dropdownEl.querySelectorAll(
      '.cm-codeblock-dropdown-item',
    )
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const lang = (item as HTMLElement).dataset.lang
        if (lang) this.selectLanguage(lang)
      })
      item.addEventListener('mouseenter', () => {
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10)
        this.highlightedIndex = index
        this.updateDropdownHighlight()
      })
    })

    const customItem = this.dropdownEl.querySelector(
      '.cm-codeblock-dropdown-custom',
    )
    customItem?.addEventListener('click', () => {
      this.selectLanguage(this.searchQuery.trim())
    })
    customItem?.addEventListener('mouseenter', () => {
      this.highlightedIndex = filtered.length
      this.updateDropdownHighlight()
    })
  }

  private updateDropdownHighlight(): void {
    if (!this.dropdownEl) return
    const items = this.dropdownEl.querySelectorAll(
      '.cm-codeblock-dropdown-item, .cm-codeblock-dropdown-custom',
    )
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === this.highlightedIndex)
    })
  }

  private handleSearchInputPortal = (event: Event): void => {
    const input = event.target as HTMLInputElement
    this.searchQuery = input.value
    this.highlightedIndex = 0
    this.updateDropdownContent()
    // Refocus input after content update
    requestAnimationFrame(() => {
      const newInput = this.dropdownEl?.querySelector(
        '.cm-codeblock-dropdown-input',
      ) as HTMLInputElement | null
      if (newInput && newInput !== document.activeElement) {
        const cursorPos = input.selectionStart
        newInput.focus()
        newInput.setSelectionRange(cursorPos, cursorPos)
      }
    })
  }

  handleDropdownKeydown = (event: KeyboardEvent): void => {
    const filtered = this.filteredLanguages
    const showCustom = this.showCustomOption
    const totalItems = filtered.length + (showCustom ? 1 : 0)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.highlightedIndex =
          (this.highlightedIndex + 1) % Math.max(1, totalItems)
        this.updateDropdownHighlight()
        this.scrollToHighlighted()
        break
      case 'ArrowUp':
        event.preventDefault()
        this.highlightedIndex =
          (this.highlightedIndex - 1 + Math.max(1, totalItems)) %
          Math.max(1, totalItems)
        this.updateDropdownHighlight()
        this.scrollToHighlighted()
        break
      case 'Enter':
        event.preventDefault()
        if (this.highlightedIndex < filtered.length) {
          this.selectLanguage(filtered[this.highlightedIndex])
        } else if (showCustom) {
          this.selectLanguage(this.searchQuery.trim())
        }
        break
      case 'Escape':
        event.preventDefault()
        this.closeDropdown()
        break
    }
  }

  private scrollToHighlighted(): void {
    const highlighted = this.dropdownEl?.querySelector(
      '.cm-codeblock-dropdown-item.highlighted, .cm-codeblock-dropdown-custom.highlighted',
    ) as HTMLElement | null
    highlighted?.scrollIntoView({ block: 'nearest' })
  }

  selectLanguage = (lang: string): void => {
    const newLang = lang.trim()
    this.closeDropdown()
    if (newLang === this.language) return

    this.language = newLang
    this.syncLanguageToOuter(newLang)
  }

  private syncLanguageToOuter(newLang: string): void {
    if (!this.outerView) return

    // The language is on the first line after ```, e.g., "```typescript"
    // We need to replace the old language with the new one
    const langLine = this.outerView.state.doc.line(
      this.outerView.state.doc.lineAt(this.blockStart).number,
    )
    const lineText = langLine.text

    // Match the opening fence pattern: ```lang or ``` lang (with possible space)
    const match = /^```(.*)$/.exec(lineText)
    if (!match) return

    const existingInfo = match[1]
    // Replace only the language part, preserve any other info after spaces
    const parts = existingInfo.trim().split(/\s+/)

    // Update the language part (first token)
    parts[0] = newLang

    const newInfo = parts.filter(Boolean).join(' ')
    const newLineText = `\`\`\`${newInfo}`

    this.outerView.dispatch({
      changes: { from: langLine.from, to: langLine.to, insert: newLineText },
      userEvent: 'input',
    })
  }

  private scheduleOuterMeasure(): void {
    if (!this.outerView || this.measureScheduled) return
    this.measureScheduled = true
    requestAnimationFrame(() => {
      this.measureScheduled = false
      this.outerView?.requestMeasure()
    })
  }

  private handleFocus = (): void => {
    if (!this.outerView) return
    this.outerView.dispatch({
      selection: { anchor: this.enterPos },
    })
  }

  private exitIfAtBoundary(direction: 'up' | 'down'): boolean {
    if (!this.outerView || !this.innerView) return false
    const selection = this.innerView.state.selection.main
    if (!selection.empty) return false

    const innerDoc = this.innerView.state.doc
    const line = innerDoc.lineAt(selection.head)

    if (direction === 'up') {
      if (line.number !== 1 || selection.head !== line.from) return false
      const target = Math.max(0, this.blockStart - 1)
      this.outerView.dispatch({
        selection: { anchor: target },
      })
      this.outerView.focus()
      return true
    }

    if (line.number !== innerDoc.lines || selection.head !== line.to) {
      return false
    }

    const target = Math.min(this.outerView.state.doc.length, this.blockEnd + 1)
    this.outerView.dispatch({
      selection: { anchor: target },
    })
    this.outerView.focus()
    return true
  }

  private syncInnerDoc(): void {
    if (!this.innerView) return
    const current = this.innerView.state.doc.toString()
    if (current === this.code) return
    this.syncingFromOuter = true
    this.innerView.dispatch({
      changes: { from: 0, to: current.length, insert: this.code },
    })
    this.syncingFromOuter = false
  }

  private syncOuterDoc(next: string): void {
    if (!this.outerView) return
    const current = this.outerView.state.doc.sliceString(
      this.contentFrom,
      this.contentTo,
    )
    if (current === next) return
    this.outerView.dispatch({
      changes: { from: this.contentFrom, to: this.contentTo, insert: next },
      userEvent: 'input',
    })
  }

  private applyTheme(): void {
    if (!this.innerView) return
    const theme = this.isDark ? oneDark : githubLight
    this.innerView.dispatch({
      effects: this.themeCompartment.reconfigure(theme),
    })
  }

  private applyLanguage(): void {
    if (!this.innerView) return
    const description = findLanguageDescription(this.language)
    const requestId = ++this.languageLoadId

    if (!description) {
      this.innerView.dispatch({
        effects: this.languageCompartment.reconfigure([]),
      })
      return
    }

    description
      .load()
      .then((support) => {
        if (!this.innerView || requestId !== this.languageLoadId) return
        this.innerView.dispatch({
          effects: this.languageCompartment.reconfigure(support),
        })
      })
      .catch(() => {
        if (!this.innerView || requestId !== this.languageLoadId) return
        this.innerView.dispatch({
          effects: this.languageCompartment.reconfigure([]),
        })
      })
  }
}

if (!customElements.get(codeBlockTagName)) {
  customElements.define(codeBlockTagName, CodeBlockElement)
}

// Widget for code block with codemirror highlighting
class CodeBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly language: string,
    readonly isDark: boolean,
    readonly enterPos: number,
    readonly contentFrom: number,
    readonly contentTo: number,
    readonly blockStart: number,
    readonly blockEnd: number,
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement(codeBlockTagName) as CodeBlockElement
    element.code = this.code
    element.language = this.language
    element.isDark = this.isDark
    element.enterPos = this.enterPos
    element.contentFrom = this.contentFrom
    element.contentTo = this.contentTo
    element.blockStart = this.blockStart
    element.blockEnd = this.blockEnd
    element.outerView = view
    element.dataset.enterPos = String(this.enterPos)
    return element
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (!(dom instanceof CodeBlockElement)) return false
    dom.code = this.code
    dom.language = this.language
    dom.isDark = this.isDark
    dom.enterPos = this.enterPos
    dom.contentFrom = this.contentFrom
    dom.contentTo = this.contentTo
    dom.blockStart = this.blockStart
    dom.blockEnd = this.blockEnd
    dom.outerView = view
    dom.dataset.enterPos = String(this.enterPos)
    return true
  }

  eq(other: CodeBlockWidget): boolean {
    return (
      this.code === other.code &&
      this.language === other.language &&
      this.isDark === other.isDark &&
      this.enterPos === other.enterPos &&
      this.contentFrom === other.contentFrom &&
      this.contentTo === other.contentTo &&
      this.blockStart === other.blockStart &&
      this.blockEnd === other.blockEnd
    )
  }

  ignoreEvent(_event: Event): boolean {
    return true
  }
}

interface CodeBlock {
  startLine: number
  endLine: number
  language: string
  code: string
  startFrom: number
  endTo: number
  contentFrom: number
  contentTo: number
}

// Find all code blocks in the document
const findCodeBlocks = (state: EditorState): CodeBlock[] => {
  const blocks: CodeBlock[] = []

  let inCodeBlock = false
  let currentBlock: Partial<CodeBlock> & { codeLines?: string[] } = {}

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber)

    if (!inCodeBlock) {
      const startMatch = codeBlockStartRegex.exec(line.text)
      if (startMatch) {
        inCodeBlock = true
        const info = startMatch[1].trim()
        currentBlock = {
          startLine: lineNumber,
          language: parseCodeBlockLanguage(info),
          startFrom: line.from,
          codeLines: [],
        }
      }
    } else {
      if (codeBlockEndRegex.test(line.text)) {
        const contentStartLine = currentBlock.startLine! + 1
        const contentEndLine = lineNumber - 1
        const hasContent = contentStartLine <= contentEndLine
        const contentFrom = hasContent
          ? state.doc.line(contentStartLine).from
          : line.from
        const contentTo = hasContent
          ? state.doc.line(contentEndLine).to
          : line.from
        blocks.push({
          startLine: currentBlock.startLine!,
          endLine: lineNumber,
          language: currentBlock.language!,
          code: currentBlock.codeLines!.join('\n'),
          startFrom: currentBlock.startFrom!,
          endTo: line.to,
          contentFrom,
          contentTo,
        })
        inCodeBlock = false
        currentBlock = {}
      } else {
        currentBlock.codeLines!.push(line.text)
      }
    }
  }

  return blocks
}

export const isLineInsideCodeBlock = (
  doc: Text,
  lineNumber: number,
): boolean => {
  let inCodeBlock = false

  for (let i = 1; i < lineNumber; i++) {
    const line = doc.line(i)
    if (!inCodeBlock) {
      if (codeBlockStartRegex.test(line.text)) {
        inCodeBlock = true
      }
    } else if (codeBlockEndRegex.test(line.text)) {
      inCodeBlock = false
    }
  }

  return inCodeBlock
}

// Check if cursor is within a code block
const isCursorInCodeBlock = (state: EditorState, block: CodeBlock): boolean => {
  const { from, to } = state.selection.main
  return from <= block.endTo && to >= block.startFrom
}

// Detect dark mode
const isDarkMode = (): boolean => {
  return document.documentElement.classList.contains('dark')
}

const getCodeBlockEntryPos = (state: EditorState, block: CodeBlock): number => {
  const lineNumber = Math.min(block.startLine + 1, block.endLine)
  return state.doc.line(lineNumber).from
}

const getCodeBlockExitPos = (state: EditorState, block: CodeBlock): number => {
  const lineNumber = Math.max(block.endLine - 1, block.startLine + 1)
  return state.doc.line(lineNumber).from
}

const getBlockContainingSelection = (
  state: EditorState,
  blocks: CodeBlock[],
): CodeBlock | undefined => {
  return blocks.find((block) => isCursorInCodeBlock(state, block))
}

const findCodeBlockElement = (
  view: EditorView,
  enterPos: number,
): CodeBlockElement | null => {
  const domAtPos = view.domAtPos(enterPos).node
  const element = (
    domAtPos instanceof HTMLElement ? domAtPos : domAtPos.parentElement
  ) as HTMLElement | null
  const found = element?.closest?.(codeBlockTagName) as CodeBlockElement | null
  if (found) return found
  return view.dom.querySelector(
    `${codeBlockTagName}[data-enter-pos="${enterPos}"]`,
  ) as CodeBlockElement | null
}

const focusCodeBlockEditor = (
  view: EditorView,
  enterPos: number,
  position: 'start' | 'end',
  retries: number = 3,
): void => {
  const attempt = () => {
    const element = findCodeBlockElement(view, enterPos)
    if (!element) return false
    element.focusEditor(position)
    return true
  }

  if (attempt() || retries <= 0) return
  requestAnimationFrame(() => {
    focusCodeBlockEditor(view, enterPos, position, retries - 1)
  })
}

const buildCodeBlockDecorations = (state: EditorState): DecorationSet => {
  const decorations: Range<Decoration>[] = []
  const blocks = findCodeBlocks(state)
  const dark = isDarkMode()

  for (const block of blocks) {
    decorations.push(
      Decoration.replace({
        widget: new CodeBlockWidget(
          block.code,
          block.language,
          dark,
          getCodeBlockEntryPos(state, block),
          block.contentFrom,
          block.contentTo,
          block.startFrom,
          block.endTo,
        ),
        block: true,
      }).range(block.startFrom, block.endTo),
    )
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(decorations)
}

const codeBlockWysiwygField = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state)
  },
  update(value, tr) {
    const selectionChanged = !tr.startState.selection.eq(tr.state.selection)
    const effectsChanged = tr.effects.length > 0

    if (!tr.docChanged && !selectionChanged && !effectsChanged) {
      return value
    }

    return buildCodeBlockDecorations(tr.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const autoCloseCodeBlockAnnotation = Annotation.define<number>()

const autoCloseCodeBlockFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr
  if (!tr.isUserEvent('input')) return tr

  let insertedBacktick = false
  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    if (insertedBacktick || inserted.length === 0) return
    if (inserted.toString().includes('`')) {
      insertedBacktick = true
    }
  })
  if (!insertedBacktick) return tr

  const selection = tr.newSelection.main
  if (!selection.empty) return tr

  const doc = tr.newDoc
  const line = doc.lineAt(selection.head)

  if (selection.head !== line.to) return tr
  if (!codeBlockStartRegex.test(line.text)) return tr
  if (isLineInsideCodeBlock(doc, line.number)) return tr

  const insertFrom = line.to
  const insert = '\n\n```\n'
  const anchor = insertFrom + 1

  return [
    tr,
    {
      changes: { from: insertFrom, to: insertFrom, insert },
      selection: { anchor, head: anchor },
      annotations: autoCloseCodeBlockAnnotation.of(anchor),
      scrollIntoView: true,
      sequential: true,
      userEvent: 'input.complete',
    },
  ]
})

const autoCloseCodeBlockFocus = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return

  let enterPos: number | null = null
  for (const tr of update.transactions) {
    const value = tr.annotation(autoCloseCodeBlockAnnotation)
    if (typeof value === 'number') {
      enterPos = value
      break
    }
  }
  if (enterPos == null) return

  focusCodeBlockEditor(update.view, enterPos, 'start')
})

const codeBlockWysiwygKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowDown',
      run(view) {
        const { state } = view
        if (!state.selection.main.empty) return false

        const blocks = findCodeBlocks(state)
        if (getBlockContainingSelection(state, blocks)) return false

        const currentLine = state.doc.lineAt(state.selection.main.head)
        let nextLineNumber = currentLine.number + 1
        if (nextLineNumber > state.doc.lines) return false

        if (isHiddenSeparatorLine(state, nextLineNumber)) {
          nextLineNumber += 1
        }
        if (nextLineNumber > state.doc.lines) return false

        const block = blocks.find((item) => item.startLine === nextLineNumber)
        if (!block) return false

        view.dispatch({
          selection: { anchor: getCodeBlockEntryPos(state, block) },
          scrollIntoView: true,
        })
        focusCodeBlockEditor(view, getCodeBlockEntryPos(state, block), 'start')
        return true
      },
    },
    {
      key: 'ArrowUp',
      run(view) {
        const { state } = view
        if (!state.selection.main.empty) return false

        const blocks = findCodeBlocks(state)
        if (getBlockContainingSelection(state, blocks)) return false

        const currentLine = state.doc.lineAt(state.selection.main.head)
        let prevLineNumber = currentLine.number - 1
        if (prevLineNumber < 1) return false

        if (isHiddenSeparatorLine(state, prevLineNumber)) {
          prevLineNumber -= 1
        }
        if (prevLineNumber < 1) return false

        const block = blocks.find((item) => item.endLine === prevLineNumber)
        if (!block) return false

        view.dispatch({
          selection: { anchor: getCodeBlockExitPos(state, block) },
          scrollIntoView: true,
        })
        focusCodeBlockEditor(view, getCodeBlockEntryPos(state, block), 'end')
        return true
      },
    },
  ]),
)

const codeBlockDetector = blockDetectorFacet.of({
  type: 'codeblock',
  priority: 100,
  detect: (state) => {
    const blocks = findCodeBlocks(state)
    return blocks.map((b) => ({
      from: b.startFrom,
      to: b.endTo,
      startLine: b.startLine,
      endLine: b.endLine,
    }))
  },
})

export const codeBlockWysiwygExtension = [
  codeBlockDetector,
  codeBlockWysiwygField,
  autoCloseCodeBlockFilter,
  autoCloseCodeBlockFocus,
  codeBlockWysiwygKeymap,
]

declare global {
  interface HTMLElementTagNameMap {
    'cm-wysiwyg-codeblock': CodeBlockElement
  }
}

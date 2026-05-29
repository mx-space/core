import { css, html, LitElement } from 'lit'
import type { EditorView } from '@codemirror/view'

import { StateEffect } from '@codemirror/state'
import { WidgetType } from '@codemirror/view'

import { showImagePopover } from '../image-popover-state'
import { getPendingUpload, isPendingUploadId } from '../upload-store'

const DEFAULT_ESTIMATED_IMAGE_HEIGHT = 240
const imageHeightCache = new Map<string, number>()
const imageTagName = 'cm-wysiwyg-image'

export const imageHeightChangedEffect = StateEffect.define<{
  url: string
  height: number
}>()

class ImageElement extends LitElement {
  static properties = {
    src: { type: String },
    alt: { type: String },
    isBlock: { type: Boolean },
    matchStart: { type: Number },
    matchEnd: { type: Number },
    // Internal state
    isLoading: { type: Boolean, state: true },
    hasError: { type: Boolean, state: true },
    isUploading: { type: Boolean, state: true },
    uploadError: { type: Boolean, state: true },
    uploadBase64: { type: String, state: true },
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      margin: 0;
      padding: 8px 0 !important;
      line-height: 0;
      font-size: 0;
      text-align: center;
    }

    :host([isblock]) {
      display: block;
      width: 100%;
      margin: 0;
      padding: 8px 0 !important;
    }

    .image-inner {
      display: inline-block;
      position: relative;
    }

    .image {
      max-width: 100%;
      max-height: 300px;
      border-radius: 0.375rem;
      object-fit: contain;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    :host([isblock]) .image {
      max-height: 400px;
      border-radius: 0.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .image:hover {
      opacity: 0.85;
    }

    /* Uploading state */
    .uploading-container {
      position: relative;
      display: inline-block;
      cursor: pointer;
    }

    .uploading-img {
      opacity: 0.6;
      filter: blur(1px);
    }

    .uploading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 0.375rem;
      color: white;
    }

    :host([isblock]) .uploading-overlay {
      border-radius: 0.5rem;
    }

    .uploading-spinner {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: spin 1s linear infinite;
    }

    .uploading-text {
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.4;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .uploading-error-icon {
      color: #ef4444;
    }

    .uploading-error-icon svg {
      display: block;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    /* Error placeholder */
    .error-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.5rem 2rem;
      min-width: 200px;
      min-height: 120px;
      border-radius: 0.5rem;
      border: 1px dashed;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease;
      border-color: #d4d4d4;
      background-color: #fafafa;
    }

    :host-context(html.dark) .error-placeholder {
      border-color: #404040;
      background-color: #171717;
    }

    .error-placeholder:hover {
      border-color: #a3a3a3;
      background-color: #f5f5f5;
    }

    :host-context(html.dark) .error-placeholder:hover {
      border-color: #525252;
      background-color: #262626;
    }

    .error-icon {
      color: #a3a3a3;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    :host-context(html.dark) .error-icon {
      color: #525252;
    }

    .error-url {
      font-family:
        ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
        'Liberation Mono', monospace;
      font-size: 0.75rem;
      line-height: 1.4;
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #737373;
    }

    :host-context(html.dark) .error-url {
      color: #a3a3a3;
    }

    .error-hint {
      font-size: 0.75rem;
      line-height: 1.4;
      color: #a3a3a3;
    }

    :host-context(html.dark) .error-hint {
      color: #525252;
    }
  `

  declare src: string
  declare alt: string
  declare isBlock: boolean
  declare matchStart: number
  declare matchEnd: number
  declare isLoading: boolean
  declare hasError: boolean
  declare isUploading: boolean
  declare uploadError: boolean
  declare uploadBase64: string

  outerView?: EditorView
  private resizeObserver?: ResizeObserver
  private lastMeasuredHeight = 0

  constructor() {
    super()
    this.src = ''
    this.alt = ''
    this.isBlock = false
    this.matchStart = 0
    this.matchEnd = 0
    this.isLoading = true
    this.hasError = false
    this.isUploading = false
    this.uploadError = false
    this.uploadBase64 = ''
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.checkUploadStatus()
  }

  disconnectedCallback(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = undefined
    }
    super.disconnectedCallback()
  }

  private checkUploadStatus(): void {
    if (isPendingUploadId(this.src)) {
      const pendingUpload = getPendingUpload(this.src)
      if (pendingUpload) {
        this.isUploading = true
        this.uploadError = pendingUpload.status === 'error'
        this.uploadBase64 = pendingUpload.base64
        this.isLoading = false
        return
      }
    }
    this.isUploading = false
    this.uploadBase64 = ''
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('src')) {
      this.isLoading = true
      this.hasError = false
      this.checkUploadStatus()
    }
  }

  private handleImageLoad = (): void => {
    this.isLoading = false
    this.hasError = false
    this.updateHeight()
  }

  private handleImageError = (): void => {
    this.isLoading = false
    this.hasError = true
  }

  private updateHeight(): void {
    const img = this.shadowRoot?.querySelector('.image') as HTMLImageElement
    if (!img?.isConnected) return

    const nextHeight = Math.round(img.getBoundingClientRect().height)
    if (!nextHeight || nextHeight === this.lastMeasuredHeight) return
    this.lastMeasuredHeight = nextHeight

    if (imageHeightCache.get(this.src) !== nextHeight) {
      imageHeightCache.set(this.src, nextHeight)
      if (this.outerView) {
        this.outerView.dispatch({
          effects: imageHeightChangedEffect.of({
            url: this.src,
            height: nextHeight,
          }),
        })
        this.outerView.requestMeasure()
      }
    }
  }

  private handleClick = (e: Event): void => {
    e.preventDefault()
    e.stopPropagation()
    this.openEditPopover()
  }

  private openEditPopover(): void {
    if (!this.outerView) return

    // Find an element to get the bounding rect from
    const targetElement =
      this.shadowRoot?.querySelector('.image-inner') ||
      this.shadowRoot?.querySelector('.uploading-container') ||
      this.shadowRoot?.querySelector('.error-placeholder') ||
      this

    // Create a proxy object that provides getBoundingClientRect from the visual element
    // and dataset from the component properties
    const proxyElement = {
      getBoundingClientRect: () =>
        (targetElement as HTMLElement).getBoundingClientRect(),
      dataset: {
        alt: this.alt,
        url: this.src,
        matchStart: String(this.matchStart),
        matchEnd: String(this.matchEnd),
      },
    } as unknown as HTMLElement
    showImagePopover(proxyElement, this.outerView)
  }

  firstUpdated(): void {
    const img = this.shadowRoot?.querySelector('.image') as HTMLImageElement
    if (img && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateHeight())
      this.resizeObserver.observe(img)
    }
  }

  private get displayUrl(): string {
    return this.src.length > 50
      ? `${this.src.slice(0, 25)}...${this.src.slice(-22)}`
      : this.src
  }

  render() {
    // Uploading state
    if (this.isUploading) {
      return html`
        <div
          class="uploading-container"
          @click=${this.handleClick}
          title="点击编辑"
        >
          <img
            class="image uploading-img"
            src=${this.uploadBase64}
            alt=${this.alt || '上传中'}
          />
          <div class="uploading-overlay">
            ${this.uploadError
              ? html`
                  <div class="uploading-error-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" x2="9" y1="9" y2="15" />
                      <line x1="9" x2="15" y1="9" y2="15" />
                    </svg>
                  </div>
                  <span class="uploading-text">上传失败</span>
                `
              : html`
                  <div class="uploading-spinner">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  </div>
                  <span class="uploading-text">上传中...</span>
                `}
          </div>
        </div>
      `
    }

    // Error state
    if (this.hasError) {
      return html`
        <div
          class="error-placeholder"
          @click=${this.handleClick}
          title="点击编辑 · ${this.alt || this.src}"
        >
          <div class="error-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              <line
                x1="4"
                y1="4"
                x2="20"
                y2="20"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>
          <div class="error-url">${this.displayUrl}</div>
          <div class="error-hint">图片加载失败，点击编辑</div>
        </div>
      `
    }

    // Normal state
    return html`
      <span
        class="image-inner"
        data-alt=${this.alt}
        data-url=${this.src}
        data-match-start=${this.matchStart}
        data-match-end=${this.matchEnd}
      >
        <img
          class="image"
          src=${this.src}
          alt=${this.alt}
          title="点击编辑 · ${this.alt || this.src}"
          @load=${this.handleImageLoad}
          @error=${this.handleImageError}
          @click=${this.handleClick}
        />
      </span>
    `
  }
}

if (!customElements.get(imageTagName)) {
  customElements.define(imageTagName, ImageElement)
}

// Widget wrapper for CodeMirror
export class ImageWidget extends WidgetType {
  private readonly estimatedHeightValue: number

  constructor(
    readonly alt: string,
    readonly url: string,
    readonly matchStart: number,
    readonly matchEnd: number,
    readonly isBlock = false,
  ) {
    super()
    this.estimatedHeightValue =
      imageHeightCache.get(this.url) ?? DEFAULT_ESTIMATED_IMAGE_HEIGHT
  }

  get estimatedHeight(): number {
    return this.estimatedHeightValue
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement(imageTagName) as ImageElement
    element.src = this.url
    element.alt = this.alt
    element.isBlock = this.isBlock
    element.matchStart = this.matchStart
    element.matchEnd = this.matchEnd
    element.outerView = view

    if (this.isBlock) {
      element.setAttribute('isblock', '')
    }

    return element
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (!(dom instanceof ImageElement)) return false
    dom.src = this.url
    dom.alt = this.alt
    dom.isBlock = this.isBlock
    dom.matchStart = this.matchStart
    dom.matchEnd = this.matchEnd
    dom.outerView = view

    if (this.isBlock) {
      dom.setAttribute('isblock', '')
    } else {
      dom.removeAttribute('isblock')
    }

    return true
  }

  eq(other: ImageWidget): boolean {
    return (
      this.url === other.url &&
      this.alt === other.alt &&
      this.matchStart === other.matchStart &&
      this.matchEnd === other.matchEnd &&
      this.estimatedHeightValue === other.estimatedHeightValue &&
      this.isBlock === other.isBlock
    )
  }

  ignoreEvent(): boolean {
    return false
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cm-wysiwyg-image': ImageElement
  }
}

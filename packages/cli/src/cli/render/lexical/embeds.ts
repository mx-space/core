import { ANSI, wrap } from '../markdown'
import type { BlockRenderer } from './walker'

const basename = (path: string): string => {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

export const imgRenderer: BlockRenderer = (node, ctx) => {
  const { alt, src, caption } = node.attrs
  let label: string
  if (alt) label = `[image: ${alt}]`
  else if (src) label = `[image: ${basename(src)}]`
  else label = '[image]'
  const main = wrap(ANSI.dim, label, ctx.color)
  if (caption) {
    const cap = wrap(ANSI.dim, caption, ctx.color)
    return `${main}\n${cap}`
  }
  return main
}

export const videoRenderer: BlockRenderer = (node, ctx) => {
  const { src } = node.attrs
  return wrap(ANSI.dim, `[video: ${src ?? ''}]`, ctx.color)
}

export const linkCardRenderer: BlockRenderer = (node, ctx) => {
  const { url, title, description } = node.attrs
  if (!title) {
    return wrap(ANSI.dim, `[link: ${url ?? ''}]`, ctx.color)
  }
  const top = `${wrap(ANSI.dim, '┌ ', ctx.color)}${title}`
  const bottom = wrap(ANSI.dim, `└ ${url ?? ''}`, ctx.color)
  if (description) {
    const mid = wrap(ANSI.dim, `│ ${description}`, ctx.color)
    return `${top}\n${mid}\n${bottom}`
  }
  return `${top}\n${bottom}`
}

export const embedRenderer: BlockRenderer = (node, ctx) => {
  const { url, source } = node.attrs
  const label = source
    ? `[embed: ${source} ${url ?? ''}]`
    : `[embed: ${url ?? ''}]`
  return wrap(ANSI.dim, label, ctx.color)
}

export const embedRendererEntries: ReadonlyArray<
  readonly [string, BlockRenderer]
> = [
  ['img', imgRenderer],
  ['video', videoRenderer],
  ['link-card', linkCardRenderer],
  ['embed', embedRenderer],
]

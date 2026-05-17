/**
 * @file embed/index.ts
 * @description Compile-time inlined template assets.
 *
 * Vite (and vite-node / vitest) materialises `?raw` imports as string
 * literals so the bundle ships these files without any runtime
 * filesystem dependency.
 *
 * NOTE: `.css` files are stored on disk as `.css.txt` because Vite's
 * built-in CSS plugin intercepts `.css?raw` before the raw-text handler
 * can run, returning an empty stub in SSR/vitest. Keys are normalised
 * back to their canonical `.css` form so call sites can keep passing
 * paths like `/markdown/markdown.css`.
 *
 */
import emailGuest from './email-template/guest.template.ejs?raw'
import emailNewsletter from './email-template/newsletter.template.ejs?raw'
import emailOwner from './email-template/owner.template.ejs?raw'
import markdownCss from './markdown/markdown.css.txt?raw'
import themeGithub from './markdown/theme/github.css.txt?raw'
import themeGothic from './markdown/theme/gothic.css.txt?raw'
import themeHan from './markdown/theme/han.css.txt?raw'
import themeNewsprint from './markdown/theme/newsprint.css.txt?raw'
import renderDownloadAdmin from './render/download-admin.ejs?raw'
import renderLocalDev from './render/local-dev.ejs?raw'
import renderMarkdown from './render/markdown.ejs?raw'

export const EMBED_FILES: Record<string, string> = {
  '/email-template/guest.template.ejs': emailGuest,
  '/email-template/newsletter.template.ejs': emailNewsletter,
  '/email-template/owner.template.ejs': emailOwner,
  '/markdown/markdown.css': markdownCss,
  '/markdown/theme/github.css': themeGithub,
  '/markdown/theme/gothic.css': themeGothic,
  '/markdown/theme/han.css': themeHan,
  '/markdown/theme/newsprint.css': themeNewsprint,
  '/render/download-admin.ejs': renderDownloadAdmin,
  '/render/local-dev.ejs': renderLocalDev,
  '/render/markdown.ejs': renderMarkdown,
}

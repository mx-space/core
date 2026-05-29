let diffHighlighterReady: Promise<void> | null = null

export function ensureDiffHighlighter(
  preloadHighlighter: typeof import('@pierre/diffs').preloadHighlighter,
) {
  diffHighlighterReady ??= preloadHighlighter({
    langs: ['markdown', 'json', 'typescript', 'javascript', 'html', 'css'],
    themes: ['github-dark', 'github-light'],
  })
  return diffHighlighterReady
}

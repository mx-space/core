import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type {
  AvailableSnippetPackage,
  ImportFunctionPreview,
  ImportPackagePreview,
} from '../types/snippets'

import { fetchGitHubSnippetTree, fetchGitHubText } from '~/api/github-snippets'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export async function fetchAvailableSnippetPackages(): Promise<
  AvailableSnippetPackage[]
> {
  const data = await fetchGitHubSnippetTree()

  if (!Array.isArray(data)) return []

  return data
    .filter(
      (item) =>
        item.type === 'dir' &&
        (import.meta.env.DEV ? true : !item.name.startsWith('test:')),
    )
    .map((item) => ({
      name: item.name,
      url: item.html_url || '',
    }))
}

export async function loadSnippetPackage(
  name: string,
  t: Translator,
): Promise<ImportPackagePreview> {
  const tree = await fetchGitHubSnippetTree(name)

  if (!Array.isArray(tree)) {
    throw new Error(t('snippets.error.invalidPackage'))
  }

  const functions: ImportFunctionPreview[] = []
  const dependencies: string[] = []

  await Promise.all(
    tree.map(async (item) => {
      if (item.type === 'dir' && item.name === 'functions') {
        const files = await fetchGitHubSnippetTree(`${name}/functions`)
        if (!Array.isArray(files)) return

        await Promise.all(
          files.map(async (file) => {
            if (
              file.type !== 'file' ||
              !/\.(js|ts)$/.test(file.name) ||
              !file.download_url
            ) {
              return
            }

            const raw = await fetchGitHubText(file.download_url)
            functions.push({
              htmlUrl: file.html_url,
              name: file.name,
              raw,
              reference: name,
            })
          }),
        )
      }

      if (item.type === 'file' && item.name === 'package.json') {
        if (!item.download_url)
          throw new Error(t('snippets.error.fetchPackageJson'))
        const packageJson = JSON.parse(await fetchGitHubText(item.download_url))
        dependencies.push(
          ...Object.entries(
            (packageJson.dependencies ?? {}) as Record<string, string>,
          ).map(([packageName, version]) => `${packageName}@${version}`),
        )
      }
    }),
  )

  return { dependencies, functions }
}

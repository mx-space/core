import ejs from 'ejs'

export async function renderEjsTemplate(
  source: string,
  data: unknown,
): Promise<string> {
  if (!source) return ''
  const html = await Promise.resolve(
    ejs.render(source, (data ?? {}) as Record<string, unknown>, {
      async: true,
    }),
  )
  return String(html)
}

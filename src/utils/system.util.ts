export function getFolderSize(folderPath: string) {
  try {
    return $`du -shc ${folderPath} | head -n 1 | cut -f1`
  } catch (e: any) {
    if (e.exitCode == 141) {
      return e.stdout.trim()
    }
    return 'N/A'
  }
}

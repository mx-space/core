export function getFolderSize(folderPath: string) {
  return $`du -shc ${folderPath} | head -n 1 | cut -f1`
}

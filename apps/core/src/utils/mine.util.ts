export const isZipMinetype = (mine: string) => {
  const zipMineType = ['application/x-zip-compressed', 'application/zip']

  return zipMineType.includes(mine)
}

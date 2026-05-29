export function reorderList<TItem>(
  items: TItem[],
  oldIndex: number,
  newIndex: number,
) {
  const next = [...items]
  const [removed] = next.splice(oldIndex, 1)
  next.splice(newIndex, 0, removed)
  return next
}

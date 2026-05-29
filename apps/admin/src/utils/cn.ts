type ClassValue = false | null | string | undefined

export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(' ')
}

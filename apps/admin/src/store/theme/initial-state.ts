export type ThemeMode = 'dark' | 'light' | 'system'

export interface ThemeState {
  themeMode: ThemeMode
}

export const initialThemeState: ThemeState = {
  themeMode: 'system',
}

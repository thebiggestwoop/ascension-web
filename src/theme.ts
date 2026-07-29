const THEME_STORAGE_KEY = 'ascension-theme'

export function getStoredTheme(): 'light' | 'dark' {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

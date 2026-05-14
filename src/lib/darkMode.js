export function initDarkMode() {
  const saved = localStorage.getItem('adx_theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = saved ? saved === 'dark' : prefersDark
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

export function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('adx_theme', isDark ? 'dark' : 'light')
  return isDark
}

export function getDarkMode() {
  return document.documentElement.classList.contains('dark')
}

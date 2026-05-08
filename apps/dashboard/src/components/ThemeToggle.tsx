import useThemeStore from '../stores/theme.store'

export default function ThemeToggle() {
  const { theme, toggle } = useThemeStore()
  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

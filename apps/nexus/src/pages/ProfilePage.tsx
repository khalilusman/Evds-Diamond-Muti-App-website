import { useTranslation } from 'react-i18next'
import AppLayout from '../layouts/AppLayout'

export default function ProfilePage() {
  const { t } = useTranslation()
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('nav.profile')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Profile settings</p>
      </div>
    </AppLayout>
  )
}

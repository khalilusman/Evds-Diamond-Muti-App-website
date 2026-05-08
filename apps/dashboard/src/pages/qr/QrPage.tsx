import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../stores/auth.store'

const NEXUS_URL = 'https://nexus.evdsdiamond.com'

export default function QrPage() {
  const { user } = useAuthStore()

  const { data: qrUrl, isLoading, isError } = useQuery({
    queryKey: ['qr-nexus'],
    queryFn: async () => {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('evds_dashboard_token') ?? ''
      const res = await fetch(`${base}/api/qr/nexus`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load QR code')
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    },
    staleTime: Infinity,
  })

  if (user?.role !== 'EVDS_ADMIN') {
    return (
      <DashboardLayout title="QR Code">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">QR code management is for EVDS Administrators only.</p>
        </div>
      </DashboardLayout>
    )
  }

  function handleDownload() {
    if (!qrUrl) return
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = 'evds-nexus-qr.png'
    link.click()
  }

  function handlePrint() {
    if (!qrUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>EVDS Nexus QR Code</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center;
               justify-content: center; min-height: 100vh; font-family: sans-serif; }
        img { width: 300px; height: 300px; }
        p { margin-top: 12px; color: #555; font-size: 14px; }
      </style></head>
      <body>
        <img src="${qrUrl}" alt="EVDS Nexus QR Code" />
        <p>${NEXUS_URL}</p>
        <script>window.onload = () => { window.print(); window.close() }<\/script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <DashboardLayout title="QR Code">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 flex flex-col items-center gap-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center">Generic QR Code</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              Universal QR for marketing and packaging inserts
            </p>
          </div>

          {isLoading ? (
            <div className="w-56 h-56 flex items-center justify-center">
              <LoadingSpinner size="lg" className="text-blue-500" />
            </div>
          ) : isError ? (
            <div className="w-56 h-56 flex items-center justify-center text-red-400 text-sm">
              Failed to load QR code
            </div>
          ) : (
            <img
              src={qrUrl}
              alt="EVDS Nexus QR Code"
              className="w-56 h-56 border border-gray-100 dark:border-gray-800 rounded-xl p-2 bg-white"
            />
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{NEXUS_URL}</p>

          <div className="flex gap-3 w-full">
            <Button fullWidth onClick={handleDownload} disabled={!qrUrl}>
              Download QR Code
            </Button>
            <Button variant="secondary" fullWidth onClick={handlePrint} disabled={!qrUrl}>
              Print QR Code
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400 space-y-2">
          <p className="font-semibold">About this QR code</p>
          <p>This QR code points to the EVDS Nexus app home page. Use it on:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Marketing materials</li>
            <li>Packaging inserts</li>
            <li>Your website</li>
            <li>Trade show materials</li>
          </ul>
          <p className="pt-1">For disc-specific QR codes with pre-filled activation codes, use the Label Generator.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

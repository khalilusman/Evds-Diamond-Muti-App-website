import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import useAuthStore from '../../stores/auth.store'
import { login } from '../../api/auth.api'
import { ALLOWED_ROLES } from '../../stores/auth.store'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (!ALLOWED_ROLES.has(result.user.role)) {
        setError('Access denied. This portal is for EVDS staff only.')
        setLoading(false)
        return
      }
      setAuth(result.token, result.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Login failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">EVDS Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Internal Operations Portal</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          Sign In
        </Button>
      </form>
    </AuthLayout>
  )
}

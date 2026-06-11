import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login, isAxiosError } from '@/api/auth'
import { setAuth } from '@/store/auth'

const schema = z.object({
  email: z.string().min(1, 'E-posta zorunludur.').email('Geçerli bir e-posta giriniz.'),
  password: z.string().min(1, 'Şifre zorunludur.'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError('')
    try {
      const res = await login(data.email, data.password)
      setAuth(res.token, res.user)
      navigate('/', { replace: true })
    } catch (e) {
      if (isAxiosError(e)) {
        setServerError(
          (e.response?.data as { message?: string })?.message ?? 'Giriş başarısız.',
        )
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground mb-1">Bereket ERP</h1>
        <p className="text-sm text-muted-foreground mb-6">Sisteme giriş yapın</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              {...register('email')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.email && (
              <p className="text-xs text-status-overdue mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.password && (
              <p className="text-xs text-status-overdue mt-1">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-status-overdue">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

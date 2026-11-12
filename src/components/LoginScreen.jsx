import { useState, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { Card, CardContent } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { AlertIcon } from './Icons'
import logoAdmin from '../assets/logo_admin.png'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const login = useProduction1Store((s) => s.login)
  const toggleDevMode = useProduction1Store((s) => s.toggleDevMode)

  // Pastikan mode pengembang selalu non-aktif saat di layar login
  useEffect(() => {
    toggleDevMode(false)
  }, [toggleDevMode])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Username dan password wajib diisi.')
      return
    }

    setLoading(true)
    setErrorMessage('')
    const res = await login(username.trim(), password)
    setLoading(false)
    if (!res.success) {
      setErrorMessage(res.error || 'Username atau password salah.')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[var(--canvas)] text-[#2C3E50] flex flex-col justify-center p-4 sm:p-6 font-sans">
      <Card className="border border-[#EDE8DF] shadow-md rounded-3xl overflow-hidden bg-white">
        {/* Header Resmi dengan Logo Brand */}
        <div className="pt-8 pb-6 px-6 text-center border-b border-[#EDE8DF] bg-[#F5F1EB]/60">
          <div className="flex justify-center mb-3">
            <img
              src={logoAdmin}
              alt="Makan Dimsum Indonesia"
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-[#2C3E50]">
            MES Produksi & Traceability
          </h1>
          <p className="text-xs text-[#6B7B8D] mt-1 font-medium">
            Masuk dengan kredensial akun terdaftar
          </p>
        </div>

        <CardContent className="p-6 sm:p-7 space-y-5">
          {/* Notifikasi Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertIcon className="w-4 h-4 shrink-0 text-[#991B1B]" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form Login Kredensial Produksi */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
              disabled={loading}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                disabled={loading}
                className="min-h-[48px] rounded-xl font-bold text-sm bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] text-white transition-all shadow-sm"
              >
                Masuk ke Sistem
              </Button>
            </div>
          </form>

          {/* Footer Hak Cipta & Keamanan */}
          <div className="pt-3 text-center border-t border-[#EDE8DF]/60">
            <p className="text-[11px] text-[#8C9BA8] font-medium">
              PT Makan Dimsum Indonesia &copy; 2026
            </p>
            <p className="text-[10px] text-[#A0AEC0] mt-0.5">
              Sistem Eksekusi Manufaktur & Traceability Terintegrasi
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

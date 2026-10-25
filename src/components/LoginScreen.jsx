import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { Card, CardContent } from './ui/Card'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { AlertIcon } from './Icons'

const DIVISION_PRESETS = [
  {
    name: 'Giling & Mix',
    karyawan: 'opr_daging',
    pic: 'pic_daging'
  },
  {
    name: 'Bumbu Racik',
    karyawan: 'opr_bumbu',
    pic: 'pic_bumbu'
  },
  {
    name: 'Kulit Pangsit',
    karyawan: 'opr_kulit',
    pic: 'pic_kulit'
  },
  {
    name: 'Saos Dimsum',
    karyawan: 'opr_saos',
    pic: 'pic_saos'
  },
  {
    name: 'Cetak & Assembly',
    karyawan: 'opr_cetak',
    pic: 'pic_cetak'
  },
  {
    name: 'Packing & Checker',
    karyawan: 'opr_packing',
    pic: 'pic_packing'
  },
  {
    name: 'Gudang & Sales',
    karyawan: 'opr_gudang',
    pic: 'pic_gudang'
  }
]

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const login = useProduction1Store((s) => s.login)
  const quickSwitchUser = useProduction1Store((s) => s.quickSwitchUser)
  const toggleDevMode = useProduction1Store((s) => s.toggleDevMode)

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

  const handleSelectPreset = async (presetUser) => {
    setLoading(true)
    setErrorMessage('')
    const res = await quickSwitchUser(presetUser)
    setLoading(false)
    if (!res.success) {
      setErrorMessage(res.error || 'Gagal masuk.')
    }
  }

  const handleEnterDevMode = async () => {
    toggleDevMode(true)
    await quickSwitchUser('opr_daging')
  }

  return (
    <div className="w-full max-w-md md:max-w-lg mx-auto min-h-screen bg-[var(--canvas)] text-[#2C3E50] flex flex-col justify-center p-4 sm:p-6 font-sans">
      <Card className="border border-[#EDE8DF] shadow-md rounded-3xl overflow-hidden bg-white">
        {/* Header Bersih & Hangat */}
        <div className="pt-6 pb-4 px-5 text-center border-b border-[#EDE8DF] bg-[#F5F1EB]/60">
          <h1 className="text-sm font-bold tracking-wide text-[#2C3E50]">
            MES Produksi Dimsum
          </h1>
          <p className="text-xs text-[#6B7B8D] font-sans mt-0.5">
            Masuk ke stasiun kerja
          </p>
        </div>

        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Notifikasi Error */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertIcon className="w-4 h-4 shrink-0 text-[#991B1B]" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Pilihan Akun Divisi & Peran */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B7B8D] px-0.5">
              <span>Pilih divisi & peran</span>
              <span className="text-[11px] text-[#6B7B8D] normal-case">Karyawan / PIC</span>
            </div>

            <div className="space-y-1.5">
              {DIVISION_PRESETS.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between p-2 sm:p-2.5 rounded-2xl border border-[#EDE8DF] bg-[#F5F1EB]/40 hover:bg-[#F5F1EB] transition-colors"
                >
                  <span className="text-xs font-bold text-[#2C3E50] pr-2">
                    {d.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(d.karyawan)}
                      disabled={loading}
                      className="min-h-[44px] px-3.5 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-[#2C3E50] text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                    >
                      Karyawan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(d.pic)}
                      disabled={loading}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#2C3E50] hover:bg-[#1E2B37] text-white text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                    >
                      PIC
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => handleSelectPreset('supervisor')}
                disabled={loading}
                className="w-full min-h-[48px] rounded-2xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] active:bg-[#EDE8DF] text-[#2C3E50] text-xs font-bold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
              >
                <span>Supervisor & PPIC (Pak Yosi)</span>
              </button>
            </div>
          </div>

          {/* Pemisah Halus */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EDE8DF]" />
            </div>
            <div className="relative flex justify-center text-[11px] font-semibold">
              <span className="bg-white px-3 text-[#6B7B8D]">
                atau masuk manual
              </span>
            </div>
          </div>

          {/* Form Manual */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              Masuk
            </Button>
          </form>

          {/* Masuk Mode Dev */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleEnterDevMode}
              className="text-xs text-[#6B7B8D] hover:text-[#2C3E50] font-semibold underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] rounded py-1 px-2 transition-colors"
            >
              Masuk sebagai Pengembang (Dev)
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

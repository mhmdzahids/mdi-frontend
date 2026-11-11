import { useState } from 'react'
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { useProduction1Store } from '../store/production1Store'

export default function ChangePasswordCard() {
  const changePassword = useProduction1Store((s) => s.changePassword)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    // 1. Validasi input terisi
    if (!currentPassword) {
      setErrorMessage('Password saat ini wajib diisi.')
      return
    }
    if (!newPassword) {
      setErrorMessage('Password baru wajib diisi.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password baru minimal 6 karakter.')
      return
    }
    if (!confirmPassword) {
      setErrorMessage('Konfirmasi password baru wajib diisi.')
      return
    }

    // 2. Validasi kecocokan
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password baru tidak cocok.')
      return
    }

    // 3. Validasi tidak boleh sama dengan password saat ini
    if (newPassword === currentPassword) {
      setErrorMessage('Password baru tidak boleh sama dengan password saat ini.')
      return
    }

    setLoading(true)
    const res = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword
    })
    setLoading(false)

    if (res.success) {
      setSuccessMessage(res.message || 'Password berhasil diperbarui!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrent(false)
      setShowNew(false)
      setShowConfirm(false)
    } else {
      setErrorMessage(res.error || 'Gagal mengubah password.')
    }
  }

  // Indikator pencocokan password saat mengetik
  const isConfirmFilled = confirmPassword.length > 0
  const isMatch = isConfirmFilled && newPassword === confirmPassword
  const isMismatch = isConfirmFilled && newPassword !== confirmPassword

  return (
    <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs">
      {/* Header Card */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center shrink-0 text-[#64748B]">
          <KeyRound className="w-4 h-4 stroke-[2]" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-[#1E293B] block">
            Ganti Password
          </span>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            Gunakan minimal 6 karakter dengan hashing standar industri
          </span>
        </div>
      </div>

      {/* Pesan Sukses */}
      {successMessage && (
        <div className="mb-4 p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A] mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            {successMessage}
          </div>
        </div>
      )}

      {/* Pesan Error */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            {errorMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* 1. Password Saat Ini */}
        <Input
          label="Password Saat Ini"
          id="current-password"
          type={showCurrent ? 'text' : 'password'}
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value)
            if (errorMessage) setErrorMessage('')
          }}
          placeholder="Masukkan password saat ini"
          autoComplete="current-password"
          disabled={loading}
          rightElement={
            <button
              type="button"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={showCurrent ? 'Sembunyikan password saat ini' : 'Lihat password saat ini'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7B8D] hover:text-[#1E293B] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        {/* 2. Password Baru */}
        <Input
          label="Password Baru"
          id="new-password"
          type={showNew ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value)
            if (errorMessage) setErrorMessage('')
          }}
          placeholder="Minimal 6 karakter"
          autoComplete="new-password"
          disabled={loading}
          helperText="Minimal 6 karakter"
          rightElement={
            <button
              type="button"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? 'Sembunyikan password baru' : 'Lihat password baru'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7B8D] hover:text-[#1E293B] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        {/* 3. Konfirmasi Password Baru */}
        <div>
          <Input
            label="Konfirmasi Password Baru"
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (errorMessage) setErrorMessage('')
            }}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
            disabled={loading}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Lihat konfirmasi password'}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7B8D] hover:text-[#1E293B] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {isMatch && (
            <p className="mt-1 text-[11px] text-[#16A34A] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Konfirmasi password cocok</span>
            </p>
          )}
          {isMismatch && (
            <p className="mt-1 text-[11px] text-[#DC2626] font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Konfirmasi password belum cocok</span>
            </p>
          )}
        </div>

        {/* Tombol Simpan */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full min-h-[44px] px-4 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] active:bg-[#020617] disabled:bg-[#EDE8DF] disabled:text-[#94A3B8] disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-2xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Password...</span>
              </>
            ) : (
              <span>Simpan Password Baru</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

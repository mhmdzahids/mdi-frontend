import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { useProduction1Store } from '../store/production1Store'

export default function ChangePasswordModal({ isOpen, onClose }) {
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

  // Reset form saat modal ditutup
  const handleClose = () => {
    if (loading) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
    setErrorMessage('')
    setSuccessMessage('')
    if (onClose) onClose()
  }

  // Validasi real-time untuk Password Baru
  const hasTypedNew = newPassword.length > 0
  const isNewPasswordTooShort = hasTypedNew && newPassword.length < 6
  const isNewPasswordValid = hasTypedNew && newPassword.length >= 6

  // Validasi real-time untuk Konfirmasi Password
  const hasTypedConfirm = confirmPassword.length > 0
  const isConfirmMismatch = hasTypedConfirm && newPassword !== confirmPassword
  const isConfirmMatch = hasTypedConfirm && newPassword.length >= 6 && newPassword === confirmPassword

  const isFormValid =
    Boolean(currentPassword) &&
    isNewPasswordValid &&
    isConfirmMatch &&
    newPassword !== currentPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!currentPassword) {
      setErrorMessage('Password saat ini wajib diisi.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password baru tidak cocok.')
      return
    }
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
      // Berikan jeda sejenak agar pengguna membaca notifikasi sukses sebelum modal tertutup otomatis
      setTimeout(() => {
        handleClose()
      }, 1500)
    } else {
      setErrorMessage(res.error || 'Gagal mengubah password.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ganti Password"
      subtitle="Perbarui kata sandi akun untuk menjaga keamanan akses sistem"
      size="md"
    >
      <div className="space-y-4">
        {/* Banner Sukses */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A] mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              {successMessage}
            </div>
          </div>
        )}

        {/* Banner Error */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Field Password Saat Ini */}
          <Input
            label="Password Saat Ini"
            id="modal-current-password"
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

          {/* 2. Field Password Baru (Dengan outline merah jika < 6 karakter) */}
          <Input
            label="Password Baru"
            id="modal-new-password"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (errorMessage) setErrorMessage('')
            }}
            placeholder="Minimal 6 karakter"
            autoComplete="new-password"
            disabled={loading}
            error={
              isNewPasswordTooShort
                ? `Minimal 6 karakter (kurang ${6 - newPassword.length} karakter lagi)`
                : undefined
            }
            success={isNewPasswordValid}
            helperText={
              isNewPasswordValid ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Panjang password memenuhi syarat (minimal 6 karakter)
                </span>
              ) : !hasTypedNew ? (
                'Minimal 6 karakter'
              ) : null
            }
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

          {/* 3. Field Konfirmasi Password Baru */}
          <Input
            label="Konfirmasi Password Baru"
            id="modal-confirm-password"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (errorMessage) setErrorMessage('')
            }}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
            disabled={loading}
            error={isConfirmMismatch ? 'Konfirmasi password belum cocok' : undefined}
            success={isConfirmMatch}
            helperText={
              isConfirmMatch ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Konfirmasi password cocok
                </span>
              ) : null
            }
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

          {/* Tombol Aksi */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="min-h-[44px] px-3.5 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-[#1E293B] font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] active:bg-[#020617] disabled:bg-[#EDE8DF] disabled:text-[#94A3B8] disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-2xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { KeyRound, X, Eye, EyeOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'
import { apiPost } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'

export default function ResetPasswordModal({ isOpen, onClose, user, onSuccess }) {
  useLockBodyScroll(isOpen)

  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen || !user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword.trim().length < 6) {
      setErrorMessage('Password minimal 6 karakter.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await apiPost(`/admin/users/${user.id}/reset-password`, {
        new_password: newPassword.trim(),
        must_change_password: true
      })

      useProduction1Store.getState().actionFeedback = {
        type: 'success',
        message: `Password akun '${user.username}' berhasil direset.`
      }

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setErrorMessage(err.message || 'Gagal mereset password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[#EDE8DF] shadow-xl p-5 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE8DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF6EE] border border-[#F3DFC9] flex items-center justify-center text-[#B25E09]">
              <KeyRound className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-heading text-[#2C3E50]">Reset Password</h3>
              <p className="text-[11px] text-[#6B7B8D] mt-0.5 truncate max-w-[200px]">
                {user.full_name} (@{user.username})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-3">
          <div>
            <label className="text-xs font-bold text-[#2C3E50] block mb-1.5">
              Password Baru
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                className="w-full min-h-[48px] h-12 px-3.5 pr-11 text-base bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl text-[#2C3E50] placeholder:text-[#94A3B8] focus:bg-white focus:border-[#3A6B80] focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-[#C0392B] bg-[#FDF2F2] border border-[#F5C6CB] rounded-lg p-2">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#6B7B8D] hover:bg-[#F5F1EB] rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

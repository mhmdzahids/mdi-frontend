import { useState } from 'react'
import { User, Building2, Calendar, LogOut } from 'lucide-react'
import { useProduction1Store } from '../store/production1Store'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

/**
 * Format tanggal standar Indonesia menggunakan Intl.DateTimeFormat
 */
function formatIndonesianDate(dateString) {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d)
  } catch {
    return '-'
  }
}

/**
 * Halaman Profile Mengikuti Desain Referensi.
 *
 * Struktur:
 * 1. Avatar besar di tengah atas (tanpa tombol edit)
 * 2. Badge netral berisi role
 * 3. Satu kartu "Personal info" berisi 3 baris:
 *    - Nama
 *    - Divisi
 *    - Terdaftar sejak (menampilkan "-" jika belum ada di data backend)
 * 4. Tombol Keluar (outline danger, full-width, min-h 52px, dialog konfirmasi) di bawah kartu
 */
export default function ProfileView() {
  const currentUser = useProduction1Store((s) => s.currentUser)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const userRole = useProduction1Store((s) => s.userRole)
  const logout = useProduction1Store((s) => s.logout)

  const [showConfirmLogout, setShowConfirmLogout] = useState(false)
  useLockBodyScroll(showConfirmLogout)

  // Label peran diselaraskan dengan representasi peran di aplikasi
  const roleLabel = userRole === 'STAKEHOLDER' || userRole === 'PIC' ? 'PIC' : 'Karyawan'
  const displayName = currentUser?.full_name || operatorName || operatorId || '-'
  const divisionName = currentUser?.division || '-'
  const registeredDate = currentUser?.created_at ? formatIndonesianDate(currentUser.created_at) : '-'

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-between min-h-[calc(100vh-160px)] py-4 px-2">
      {/* Area Konten Utama */}
      <div className="flex flex-col items-center w-full">
        {/* Avatar Besar & Badge Role */}
        <div className="flex flex-col items-center text-center pt-4">
          <Avatar size="lg" />

          <div className="mt-3.5">
            <Badge variant="neutral" size="md">
              {roleLabel}
            </Badge>
          </div>
        </div>

        {/* Kartu "Personal info" Mengikuti Pola Referensi */}
        <div className="w-full bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs mt-6">
          <h3 className="text-xs font-bold font-heading text-[#2C3E50] tracking-tight mb-3">
            Personal info
          </h3>

          <div className="divide-y divide-[#EDE8DF]/70">
            {/* Baris 1: Nama */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EDE8DF]/40 border border-[#EDE8DF]/60 flex items-center justify-center shrink-0 text-[#6B7B8D]">
                <User className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-[#6B7B8D] block leading-tight">
                  Nama
                </span>
                <span
                  className="text-xs font-bold text-[#2C3E50] block truncate mt-0.5"
                  title={displayName}
                >
                  {displayName}
                </span>
              </div>
            </div>

            {/* Baris 2: Divisi */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EDE8DF]/40 border border-[#EDE8DF]/60 flex items-center justify-center shrink-0 text-[#6B7B8D]">
                <Building2 className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-[#6B7B8D] block leading-tight">
                  Divisi
                </span>
                <span
                  className="text-xs font-bold text-[#2C3E50] block truncate mt-0.5"
                  title={divisionName}
                >
                  {divisionName}
                </span>
              </div>
            </div>

            {/* Baris 3: Terdaftar sejak */}
            <div className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EDE8DF]/40 border border-[#EDE8DF]/60 flex items-center justify-center shrink-0 text-[#6B7B8D]">
                <Calendar className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-[#6B7B8D] block leading-tight">
                  Terdaftar sejak
                </span>
                <span className="text-xs font-bold text-[#2C3E50] block truncate mt-0.5">
                  {registeredDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian Bawah: Tombol Logout Tonal / Outline dengan Konfirmasi Aman */}
      <div className="w-full pt-8 pb-4">
        <button
          type="button"
          onClick={() => setShowConfirmLogout(true)}
          className="w-full min-h-[52px] px-4 rounded-xl border border-[#FADBD8] bg-[#FDEDEC]/80 hover:bg-[#FDEDEC] text-[#E8352D] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#E8352D]"
        >
          <LogOut className="w-4 h-4 stroke-[2.2]" />
          <span>Keluar</span>
        </button>
      </div>

      {/* Modal Dialog Konfirmasi Logout Sederhana */}
      {showConfirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-none transition-opacity overscroll-contain select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          onClick={() => setShowConfirmLogout(false)}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault()
          }}
        >
          <div
            className="w-full max-w-xs bg-white rounded-2xl p-5 border border-[#EDE8DF] shadow-lg text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="logout-dialog-title"
              className="text-base font-bold font-heading text-[#2C3E50]"
            >
              Keluar dari akun?
            </h3>
            <p className="text-xs text-[#6B7B8D] mt-1.5 leading-relaxed">
              Sesi kerja Anda akan diakhiri dan dialihkan ke layar login.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirmLogout(false)}
                className="min-h-[48px] px-3 rounded-xl border border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] font-semibold text-xs transition-all cursor-pointer active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmLogout(false)
                  logout()
                }}
                className="min-h-[48px] px-3 rounded-xl border border-[#FADBD8] bg-[#E8352D] hover:bg-[#D32F2F] text-white font-semibold text-xs transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

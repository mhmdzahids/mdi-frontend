import { useState, useEffect } from 'react'
import { User, Building2, Calendar, LogOut } from 'lucide-react'
import { useProduction1Store } from '../store/production1Store'
import { Avatar } from './ui/Avatar'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'
import BarcodeCalibrationStudio from './BarcodeCalibrationStudio'
import OperationalSettingsCard from './OperationalSettingsCard'
import ChangePasswordCard from './ChangePasswordCard'

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

export default function ProfileView() {
  const currentUser = useProduction1Store((s) => s.currentUser)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const userRole = useProduction1Store((s) => s.userRole)
  const isPpicUser = useProduction1Store((s) => s.isPpicUser)
  const logout = useProduction1Store((s) => s.logout)

  const isPPIC = Boolean(isPpicUser && isPpicUser())

  const [activeTab, setActiveTab] = useState('ACCOUNT')
  const [showConfirmLogout, setShowConfirmLogout] = useState(false)
  useLockBodyScroll(showConfirmLogout)

  // Karyawan dan PIC tidak berhak mengakses halaman Printer & Label dan Pengaturan
  useEffect(() => {
    if (!isPPIC && activeTab !== 'ACCOUNT') {
      setActiveTab('ACCOUNT')
    }
  }, [isPPIC, activeTab])

  const roleLabel = userRole === 'STAKEHOLDER' || userRole === 'PIC' ? 'PIC' : 'Karyawan'
  const displayName = currentUser?.full_name || operatorName || operatorId || '-'
  const divisionName = currentUser?.division || '-'
  const registeredDate = currentUser?.created_at ? formatIndonesianDate(currentUser.created_at) : '-'

  return (
    <div className="w-full max-w-md md:max-w-xl mx-auto flex flex-col space-y-4 pb-8">
      {/* Header Profil Ringkas */}
      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
        <div className="shrink-0">
          <Avatar size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#1E293B] truncate" title={displayName}>
              {displayName}
            </span>
          </div>
          <span className="text-xs text-[#64748B] block truncate mt-0.5">
            {divisionName}
          </span>
        </div>
      </div>

      {/* Navigasi Kategori (Segmented Switcher) - Khusus Akun PPIC */}
      {isPPIC && (
        <div className="grid grid-cols-3 gap-1 bg-[#EDE8DF]/60 p-1 rounded-xl border border-[#EDE8DF]">
          <button
            type="button"
            onClick={() => setActiveTab('ACCOUNT')}
            className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${activeTab === 'ACCOUNT'
              ? 'bg-white text-[#1E293B] shadow-2xs'
              : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
          >
            Akun
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRINTER')}
            className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${activeTab === 'PRINTER'
              ? 'bg-white text-[#1E293B] shadow-2xs'
              : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
          >
            Printer & Label
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${activeTab === 'SETTINGS'
              ? 'bg-white text-[#1E293B] shadow-2xs'
              : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
          >
            Pengaturan
          </button>
        </div>
      )}

      {/* Konten Kategori 1: Akun & Info Pribadi (Semua Akun / Karyawan & PIC) */}
      {(!isPPIC || activeTab === 'ACCOUNT') && (
        <div className="space-y-4">
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-bold text-[#1E293B] block mb-3">
              Informasi Akun
            </span>

            <div className="divide-y divide-[#EDE8DF]/70">
              <div className="py-2.5 first:pt-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center shrink-0 text-[#64748B]">
                  <User className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-[#64748B] block leading-tight">Nama</span>
                  <span className="text-xs font-bold text-[#1E293B] block truncate mt-0.5">{displayName}</span>
                </div>
              </div>

              <div className="py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center shrink-0 text-[#64748B]">
                  <Building2 className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-[#64748B] block leading-tight">Divisi</span>
                  <span className="text-xs font-bold text-[#1E293B] block truncate mt-0.5">{divisionName}</span>
                </div>
              </div>

              <div className="py-2.5 last:pb-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center shrink-0 text-[#64748B]">
                  <Calendar className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-[#64748B] block leading-tight">Terdaftar Sejak</span>
                  <span className="text-xs font-bold text-[#1E293B] block truncate mt-0.5">{registeredDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Ganti Password */}
          <ChangePasswordCard />

          {/* Tombol Keluar */}
          <button
            type="button"
            onClick={() => setShowConfirmLogout(true)}
            className="w-full min-h-[48px] px-4 rounded-xl border border-[#FADBD8] bg-[#FDEDEC]/80 hover:bg-[#FDEDEC] text-[#E8352D] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
            <span>Keluar Akun</span>
          </button>
        </div>
      )}

      {/* Konten Kategori 2: Printer & Kalibrasi Label (Khusus PPIC) */}
      {isPPIC && activeTab === 'PRINTER' && <BarcodeCalibrationStudio />}

      {/* Konten Kategori 3: Pengaturan Operasional & Pemeliharaan (Khusus PPIC) */}
      {isPPIC && activeTab === 'SETTINGS' && <OperationalSettingsCard />}

      {/* Modal Dialog Konfirmasi Keluar */}
      {showConfirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-none transition-opacity overscroll-contain select-none"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirmLogout(false)}
        >
          <div
            className="w-full max-w-xs bg-white rounded-2xl p-5 border border-[#EDE8DF] shadow-lg text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[#1E293B]">
              Keluar Akun?
            </h3>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Sesi kerja akan diakhiri dan kembali ke halaman login.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowConfirmLogout(false)}
                className="min-h-[44px] px-3 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-[#1E293B] font-bold text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmLogout(false)
                  logout()
                }}
                className="min-h-[44px] px-3 rounded-xl bg-[#E8352D] hover:bg-[#C92A24] text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
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

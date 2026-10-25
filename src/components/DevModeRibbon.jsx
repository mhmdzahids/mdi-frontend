import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { ChevronDown, ChevronUp, X, UserCheck } from 'lucide-react'

const ACCOUNTS = [
  { username: 'opr_daging', label: 'Daging (Karyawan)', category: 'Daging' },
  { username: 'pic_daging', label: 'Daging (PIC)', category: 'Daging' },
  { username: 'opr_bumbu', label: 'Bumbu (Karyawan)', category: 'Bumbu' },
  { username: 'pic_bumbu', label: 'Bumbu (PIC)', category: 'Bumbu' },
  { username: 'opr_kulit', label: 'Kulit (Karyawan)', category: 'Kulit' },
  { username: 'pic_kulit', label: 'Kulit (PIC)', category: 'Kulit' },
  { username: 'opr_saos', label: 'Saos (Karyawan)', category: 'Saos' },
  { username: 'pic_saos', label: 'Saos (PIC)', category: 'Saos' },
  { username: 'opr_cetak', label: 'Cetak (Karyawan)', category: 'Cetak' },
  { username: 'pic_cetak', label: 'Cetak (PIC)', category: 'Cetak' },
  { username: 'opr_packing', label: 'Packing (Karyawan)', category: 'Packing' },
  { username: 'pic_packing', label: 'Packing (PIC)', category: 'Packing' },
  { username: 'opr_gudang', label: 'Gudang (Karyawan)', category: 'Gudang' },
  { username: 'pic_gudang', label: 'Gudang (PIC)', category: 'Gudang' },
  { username: 'supervisor', label: 'PPIC (Supervisor)', category: 'PPIC' },
]

export default function DevModeRibbon() {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const toggleDevMode = useProduction1Store((s) => s.toggleDevMode)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const quickSwitchUser = useProduction1Store((s) => s.quickSwitchUser)

  if (import.meta.env.PROD || !isDevMode) return null

  return (
    <aside
      aria-label="Panel Mode Pengembang"
      className="bg-[#2C3E50] text-white border-b border-[#2C3E50] shrink-0 font-sans transition-all"
    >
      {/* Baris Ringkas Dev Toggle */}
      <div className="px-3.5 py-1.5 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[#D1E4EF] font-bold cursor-pointer hover:text-white transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5 text-[#4685ac]" />
          <span>Ganti akun cepat: <strong className="text-white font-normal underline">{currentUser?.username || 'Belum dipilih'}</strong></span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => toggleDevMode(false)}
          title="Tutup Mode DEV"
          aria-label="Tutup Toolbar Mode Dev"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7B8D] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drawer Akun yang Hanya Muncul Saat Diperlukan */}
      {isExpanded && (
        <div className="px-3.5 pb-2.5 pt-1 border-t border-[#2C3E50]/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {ACCOUNTS.map((acc) => {
              const isActive = currentUser?.username === acc.username

              return (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    quickSwitchUser(acc.username)
                    setIsExpanded(false)
                  }}
                  className={`h-9 px-3 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 cursor-pointer flex items-center active:scale-95 ${
                    isActive
                      ? 'bg-[#4685ac] text-white font-bold shadow-xs ring-1 ring-white/30'
                      : 'bg-white/10 text-[#EDE8DF] hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {acc.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}

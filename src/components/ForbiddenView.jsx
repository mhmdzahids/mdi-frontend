import { ShieldAlert, Home } from 'lucide-react'
import { motion } from 'motion/react'
import { useProduction1Store } from '../store/production1Store'
import { canAccess, ROUTE_PERMISSION_MAP } from '../utils/rbac'

export default function ForbiddenView({ pageName = 'Halaman Ini' }) {
  const currentUser = useProduction1Store((s) => s.currentUser)

  const handleBackToSafeRoute = () => {
    // 0. Super Admin selalu kembali ke Panel Admin
    if (currentUser?.is_superadmin) {
      useProduction1Store.setState({
        isAdminActive: true,
        isProfileActive: false,
        activeAdminTab: 'USERS',
        adminForm: null
      })
      window.location.hash = '#/admin'
      return
    }

    // 1. Coba default stasiun user
    const stage = currentUser?.default_stage || 'PROD_1'
    const station = currentUser?.default_station || 'MEAT'
    const prod2Tab = currentUser?.default_prod2_tab || 'INBOUND'

    if (stage === 'PROD_2' && canAccess(ROUTE_PERMISSION_MAP.PROD2_INBOUND, currentUser)) {
      useProduction1Store.setState({
        activeProductionStage: 'PROD_2',
        activeProd2Tab: prod2Tab,
        isProfileActive: false,
        isAdminActive: false
      })
      return
    }

    if (canAccess(ROUTE_PERMISSION_MAP[station], currentUser)) {
      useProduction1Store.setState({
        activeProductionStage: 'PROD_1',
        activeStation: station,
        isProfileActive: false,
        isAdminActive: false
      })
      return
    }

    // 2. Cari stasiun pertama yang diizinkan di Produksi 1
    const p1Stations = ['MEAT', 'SEASONING', 'WRAPPER', 'SAUCE', 'SUPPLIER', 'SUMMARY', 'PLAN', 'LOGS']
    const safeP1 = p1Stations.find((st) => canAccess(ROUTE_PERMISSION_MAP[st], currentUser))
    if (safeP1) {
      useProduction1Store.setState({
        activeProductionStage: 'PROD_1',
        activeStation: safeP1,
        isProfileActive: false,
        isAdminActive: false
      })
      return
    }

    // 3. Fallback ke profil pengguna
    useProduction1Store.setState({
      isProfileActive: true,
      isAdminActive: false
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto my-auto py-12 px-4 flex flex-col items-center text-center select-none"
    >
      {/* Icon Badge */}
      <div className="w-16 h-16 rounded-2xl bg-[#FFF6EE] border border-[#F3DFC9] flex items-center justify-center text-[#B25E09] mb-4 shadow-2xs">
        <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
      </div>

      {/* Chip Status */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F5F1EB] text-[#556575] border border-[#EDE8DF] mb-2.5">
        Akses Dibatasi • HTTP 403
      </span>

      {/* Title & Description */}
      <h2 className="text-lg font-bold font-heading text-[#2C3E50]">
        Izin Akses Tidak Tersedia
      </h2>

      <p className="text-xs text-[#6B7B8D] leading-relaxed max-w-xs mt-2 mb-6">
        Akun <span className="font-semibold text-[#2C3E50]">{currentUser?.full_name || currentUser?.username || 'Anda'}</span> tidak memiliki izin untuk melihat <span className="font-semibold text-[#2C3E50]">{pageName}</span>. Silakan hubungi Super Admin untuk penambahan hak akses peran.
      </p>

      {/* Tombol Kembali ke Halaman Aman */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={handleBackToSafeRoute}
        className="min-h-[44px] px-5 py-2.5 bg-[#3A6B80] hover:bg-[#2D5566] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-colors focus-visible:outline-none"
      >
        <Home className="w-4 h-4" />
        <span>Kembali ke Beranda</span>
      </motion.button>
    </motion.div>
  )
}

import { FileText, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useProduction1Store } from '../../store/production1Store'
import { Avatar } from '../ui/Avatar'
import { canAccess } from '../../utils/rbac'
import {
  MixerIcon,
  BagIcon,
  WrapperIcon,
  SauceIcon,
  LogIcon,
  CetakIcon,
  SendIcon,
  ReceiveIcon,
  ProductIcon,
  PlanIcon
} from '../Icons'

const P1_STATION_DEFS = [
  { key: 'MEAT', label: 'Giling', icon: MixerIcon, perm: 'meat:view' },
  { key: 'SEASONING', label: 'Bumbu', icon: BagIcon, perm: 'seasoning:view' },
  { key: 'WRAPPER', label: 'Kulit', icon: WrapperIcon, perm: 'wrapper:view' },
  { key: 'SAUCE', label: 'Saos', icon: SauceIcon, perm: 'sauce:view' }
]

/**
 * Komponen Bottom Navigation Adaptif (Maks 5 Tab).
 * Ditentukan murni dari izin + role/divisi, tanpa sheet Stasiun.
 */
export default function BottomNav() {
  const activeProductionStage = useProduction1Store((s) => s.activeProductionStage)
  const activeStation = useProduction1Store((s) => s.activeStation)
  const setStation = useProduction1Store((s) => s.setStation)
  const activeProd2Tab = useProduction1Store((s) => s.activeProd2Tab)
  const setProd2Tab = useProduction1Store((s) => s.setProd2Tab)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isProfileActive = useProduction1Store((s) => s.isProfileActive)
  const openProfile = useProduction1Store((s) => s.openProfile)
  const isAdminActive = useProduction1Store((s) => s.isAdminActive)
  const openAdmin = useProduction1Store((s) => s.openAdmin)
  const adminForm = useProduction1Store((s) => s.adminForm)
  const editingProduct = useProduction1Store((s) => s.editingProduct)

  // Sembunyikan BottomNav pada form halaman penuh Super Admin & Edit Produk
  if ((isAdminActive && adminForm) || editingProduct) {
    return null
  }

  const isSuper = Boolean(currentUser?.is_superadmin)
  const isCurrentlyAdmin = isAdminActive || (isSuper && !isProfileActive)

  // 1. Super Admin: Admin | Profil (Hanya 2 tab terpusat)
  if (isSuper) {
    const adminNavItems = [
      {
        key: 'ADMIN',
        label: 'Admin',
        icon: ShieldCheck,
        isActive: isCurrentlyAdmin,
        onClick: () => openAdmin()
      },
      {
        key: 'PROFILE',
        label: 'Profil',
        isProfile: true,
        isActive: isProfileActive && !isCurrentlyAdmin,
        onClick: () => openProfile()
      }
    ]

    return (
      <nav
        aria-label="Navigasi Utama Bawah"
        className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] rounded-t-2xl shadow-[0_-4px_16px_rgba(44,62,80,0.04)] z-40 flex items-center min-h-[64px] pb-[env(safe-area-inset-bottom)] select-none px-4 justify-center gap-12 sm:gap-20"
      >
        {adminNavItems.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.isActive

          return (
            <motion.button
              key={tab.key}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={tab.onClick}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-24 min-h-[48px] min-w-[48px] flex flex-col items-center justify-center transition-colors cursor-pointer focus-visible:outline-none py-1.5 px-0.5 ${
                isActive ? 'text-[#3A6B80]' : 'text-[#556575] hover:text-[#2C3E50]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active-indicator"
                  className="absolute top-0 w-8 h-1 rounded-full bg-[#3A6B80]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              {tab.isProfile ? (
                <div className="flex items-center justify-center h-[24px]">
                  <Avatar size="sm" active={isActive} />
                </div>
              ) : (
                <Icon className="w-5 h-5 stroke-[2.2]" />
              )}
              <span className="text-[11px] font-semibold mt-1 tracking-tight leading-none">
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </nav>
    )
  }

  // 2. Navigasi Adaptif Operasional (Maksimal 5 Tab)
  const candidateTabs = []

  if (activeProductionStage === 'PROD_2') {
    // Stage Produksi 2: Cetak | Packing | Produk | Riwayat
    if (canAccess('prod2_assembly:view', currentUser)) {
      candidateTabs.push({
        key: 'ASSEMBLY',
        label: 'Cetak',
        icon: CetakIcon,
        isActive: !isProfileActive && (activeProd2Tab === 'INBOUND' || activeProd2Tab === 'ASSEMBLY'),
        onClick: () => setProd2Tab('INBOUND')
      })
    }
    if (canAccess('prod2_packing:view', currentUser)) {
      candidateTabs.push({
        key: 'FREEZER',
        label: 'Packing',
        icon: SendIcon,
        isActive: !isProfileActive && activeProd2Tab === 'FREEZER',
        onClick: () => setProd2Tab('FREEZER')
      })
    }
    if (canAccess('freezer_sales:view', currentUser)) {
      candidateTabs.push({
        key: 'PRODUCTS',
        label: 'Produk',
        icon: ProductIcon,
        isActive: !isProfileActive && activeProd2Tab === 'PRODUCTS',
        onClick: () => setProd2Tab('PRODUCTS')
      })
    }
    if (canAccess('logs:view', currentUser)) {
      candidateTabs.push({
        key: 'LOGS',
        label: 'Riwayat',
        icon: LogIcon,
        isActive: !isProfileActive && activeProd2Tab === 'LOGS',
        onClick: () => setProd2Tab('LOGS')
      })
    }
  } else {
    // Stage Produksi 1: Prioritas [Rencana, Rekap, Stasiun, Masuk, Riwayat]
    // 1. Rencana
    if (canAccess('plan:view', currentUser)) {
      candidateTabs.push({
        key: 'PLAN',
        label: 'Rencana',
        icon: PlanIcon,
        isActive: !isProfileActive && activeStation === 'PLAN',
        onClick: () => setStation('PLAN')
      })
    }

    // 2. Rekap PPIC
    if (canAccess('ppic_recap:view', currentUser)) {
      candidateTabs.push({
        key: 'SUMMARY',
        label: 'Rekap',
        icon: FileText,
        isActive: !isProfileActive && activeStation === 'SUMMARY',
        onClick: () => setStation('SUMMARY')
      })
    }

    // Identifikasi apakah akun adalah PPIC murni (bukan multi-role station supervisor)
    const userRoles = (currentUser?.roles || []).map((r) => (typeof r === 'string' ? r : r?.name || ''))
    const functionalRoles = userRoles.filter((r) => r !== 'Viewer')
    const isPpicOnly = functionalRoles.length === 1 && functionalRoles[0] === 'PPIC'

    // 3. Stasiun Kerja Dapur (Ditampilkan untuk operator & multi-role; PPIC murni mengakses stasiun via Rekap PPIC)
    if (!isPpicOnly) {
      const allowedStations = P1_STATION_DEFS.filter((st) => canAccess(st.perm, currentUser))
      if (allowedStations.length > 0) {
        // Pilih stasiun yang sedang aktif jika valid, atau default pengguna, atau stasiun pertama yang diizinkan
        const activeAllowed = allowedStations.find((st) => st.key === activeStation)
        const defaultAllowed = allowedStations.find((st) => st.key === currentUser?.default_station)
        const currentStationDef = activeAllowed || defaultAllowed || allowedStations[0]

        candidateTabs.push({
          key: currentStationDef.key,
          label: currentStationDef.label,
          icon: currentStationDef.icon,
          isActive: !isProfileActive && activeStation === currentStationDef.key,
          onClick: () => setStation(currentStationDef.key)
        })
      }
    }

    // 4. Barang Masuk
    if (canAccess('inbound:view', currentUser)) {
      candidateTabs.push({
        key: 'SUPPLIER',
        label: 'Masuk',
        icon: ReceiveIcon,
        isActive: !isProfileActive && activeStation === 'SUPPLIER',
        onClick: () => setStation('SUPPLIER')
      })
    }

    // 5. Riwayat
    if (canAccess('logs:view', currentUser)) {
      candidateTabs.push({
        key: 'LOGS',
        label: 'Riwayat',
        icon: LogIcon,
        isActive: !isProfileActive && activeStation === 'LOGS',
        onClick: () => setStation('LOGS')
      })
    }
  }

  // Dibatasi maksimal 4 candidate agar bersama Profil totalnya pas maksimal 5 tab
  const trimmedCandidates = candidateTabs.slice(0, 4)

  const profileTab = {
    key: 'PROFILE',
    label: 'Profil',
    isProfile: true,
    isActive: isProfileActive,
    onClick: () => openProfile()
  }

  const finalTabs = [...trimmedCandidates, profileTab]

  return (
    <nav
      aria-label="Navigasi Utama Bawah"
      className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] rounded-t-2xl shadow-[0_-4px_16px_rgba(44,62,80,0.04)] z-40 flex items-center min-h-[64px] pb-[env(safe-area-inset-bottom)] select-none px-2 justify-around"
    >
      {finalTabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.isActive

        return (
          <motion.button
            key={tab.key}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={tab.onClick}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex-1 min-h-[48px] min-w-[48px] flex flex-col items-center justify-center transition-colors cursor-pointer focus-visible:outline-none py-1.5 px-0.5 ${
              isActive ? 'text-[#3A6B80]' : 'text-[#556575] hover:text-[#2C3E50]'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="bottom-nav-active-indicator"
                className="absolute top-0 w-8 h-1 rounded-full bg-[#3A6B80]"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            {tab.isProfile ? (
              <div className="flex items-center justify-center h-[24px]">
                <Avatar size="sm" active={isActive} />
              </div>
            ) : (
              <Icon className="w-5 h-5 stroke-[2.2]" />
            )}

            <span className="text-[11px] font-semibold mt-1 tracking-tight leading-none truncate max-w-full">
              {tab.label}
            </span>
          </motion.button>
        )
      })}
    </nav>
  )
}

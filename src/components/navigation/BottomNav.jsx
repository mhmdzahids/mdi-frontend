import { useState, useEffect } from 'react'
import { LayoutGrid, FileText } from 'lucide-react'
import { motion } from 'motion/react'
import { useProduction1Store } from '../../store/production1Store'
import { Avatar } from '../ui/Avatar'
import StationSheet from './StationSheet'
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

/**
 * Komponen Bottom Navigation Terpadu & Responsif.
 *
 * Spesifikasi:
 * - Tinggi: min-h-[72px] + safe-area
 * - Latar: 100% OPAK #FFFFFF (tanpa blur, tanpa transparansi)
 * - Sudut atas: rounded-t-[24px]
 * - Ikon: 26px, Label: min 12px, Tap Target: min 56x56px
 * - Aturan Grouping: Jika total kandidat item > 6, stasiun kerja digabung menjadi
 *   1 tab "Stasiun" yang membuka StationSheet.
 */
export default function BottomNav() {
  const activeProductionStage = useProduction1Store((s) => s.activeProductionStage)
  const activeStation = useProduction1Store((s) => s.activeStation)
  const setStation = useProduction1Store((s) => s.setStation)
  const activeProd2Tab = useProduction1Store((s) => s.activeProd2Tab)
  const setProd2Tab = useProduction1Store((s) => s.setProd2Tab)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isSupervisorUser = useProduction1Store((s) => s.isSupervisorUser)
  const isProfileActive = useProduction1Store((s) => s.isProfileActive)
  const openProfile = useProduction1Store((s) => s.openProfile)

  const [isStationSheetOpen, setIsStationSheetOpen] = useState(false)
  const canSwitchAll = isSupervisorUser()

  // Deteksi akun PPIC (Ayu)
  const isAyuPpic = Boolean(
    currentUser && (
      String(currentUser.division || '').toUpperCase().includes('PPIC') ||
      String(currentUser.operator_id || '').toUpperCase().includes('AYU') ||
      String(currentUser.username || '').toLowerCase().includes('ayu') ||
      currentUser.default_station === 'PLAN'
    )
  )

  // Otomatis kembalikan ke tab Rencana jika akun PPIC berada di stasiun teknis mesin
  useEffect(() => {
    if (isAyuPpic && ['MEAT', 'SEASONING', 'WRAPPER', 'SAUCE'].includes(activeStation)) {
      setStation('PLAN')
    }
  }, [isAyuPpic, activeStation, setStation])

  // 1. Susun Kandidat Item Produksi 1
  const prod1CandidateItems = []

  if (isAyuPpic) {
    // Khusus PPIC (Ayu): Tanpa tombol/grup stasiun, menu utama langsung di bottom bar
    prod1CandidateItems.push({
      key: 'PLAN',
      label: 'Rencana',
      icon: PlanIcon,
      isActive: !isProfileActive && activeStation === 'PLAN',
      onClick: () => setStation('PLAN')
    })

    prod1CandidateItems.push({
      key: 'SUMMARY',
      label: 'Rekap PPIC',
      icon: FileText,
      isActive: !isProfileActive && activeStation === 'SUMMARY',
      onClick: () => setStation('SUMMARY')
    })

    prod1CandidateItems.push({
      key: 'SUPPLIER',
      label: 'Barang Masuk',
      icon: ReceiveIcon,
      isActive: !isProfileActive && activeStation === 'SUPPLIER',
      onClick: () => setStation('SUPPLIER')
    })

    prod1CandidateItems.push({
      key: 'LOGS',
      label: 'Riwayat',
      icon: LogIcon,
      isActive: !isProfileActive && activeStation === 'LOGS',
      onClick: () => setStation('LOGS')
    })
  } else {
    // Non-PPIC (Operator lapangan / Supervisor umum)
    if (canSwitchAll || currentUser?.default_station === 'PLAN') {
      prod1CandidateItems.push({
        key: 'PLAN',
        label: 'Rencana',
        icon: PlanIcon,
        isActive: !isProfileActive && activeStation === 'PLAN',
        onClick: () => setStation('PLAN')
      })
    }

    if (canSwitchAll) {
      prod1CandidateItems.push({
        key: 'SUMMARY',
        label: 'Rekap PPIC',
        icon: FileText,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'SUMMARY',
        onClick: () => setStation('SUMMARY')
      })
      prod1CandidateItems.push({
        key: 'SUPPLIER',
        label: 'Barang Masuk',
        icon: ReceiveIcon,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'SUPPLIER',
        onClick: () => setStation('SUPPLIER')
      })
    }

    if (
      canSwitchAll ||
      currentUser?.default_station === 'MEAT' ||
      (!currentUser?.default_station && activeStation === 'MEAT')
    ) {
      prod1CandidateItems.push({
        key: 'MEAT',
        label: 'Giling & Mix',
        shortLabel: 'Giling',
        icon: MixerIcon,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'MEAT',
        onClick: () => setStation('MEAT')
      })
    }

    if (canSwitchAll || currentUser?.default_station === 'SEASONING') {
      prod1CandidateItems.push({
        key: 'SEASONING',
        label: 'Bumbu',
        icon: BagIcon,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'SEASONING',
        onClick: () => setStation('SEASONING')
      })
    }

    if (canSwitchAll || currentUser?.default_station === 'WRAPPER') {
      prod1CandidateItems.push({
        key: 'WRAPPER',
        label: 'Kulit',
        icon: WrapperIcon,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'WRAPPER',
        onClick: () => setStation('WRAPPER')
      })
    }

    if (canSwitchAll || currentUser?.default_station === 'SAUCE') {
      prod1CandidateItems.push({
        key: 'SAUCE',
        label: 'Saos',
        icon: SauceIcon,
        group: 'stasiun',
        isActive: !isProfileActive && activeStation === 'SAUCE',
        onClick: () => setStation('SAUCE')
      })
    }

    prod1CandidateItems.push({
      key: 'LOGS',
      label: 'Riwayat',
      icon: LogIcon,
      isActive: !isProfileActive && activeStation === 'LOGS',
      onClick: () => setStation('LOGS')
    })
  }

  // 2. Susun Kandidat Item Produksi 2
  const prod2CandidateItems = []

  if (
    canSwitchAll ||
    currentUser?.default_prod2_tab === 'INBOUND' ||
    currentUser?.default_prod2_tab === 'ASSEMBLY' ||
    currentUser?.division?.toLowerCase().includes('cetak')
  ) {
    prod2CandidateItems.push({
      key: 'INBOUND',
      label: 'Cetak',
      icon: CetakIcon,
      group: 'stasiun',
      isActive: !isProfileActive && (activeProd2Tab === 'INBOUND' || activeProd2Tab === 'ASSEMBLY'),
      onClick: () => setProd2Tab('INBOUND')
    })
  }

  if (
    canSwitchAll ||
    currentUser?.default_prod2_tab === 'PACKING' ||
    currentUser?.division?.toLowerCase().includes('packing')
  ) {
    prod2CandidateItems.push({
      key: 'FREEZER',
      label: 'Packing',
      icon: SendIcon,
      group: 'stasiun',
      isActive: !isProfileActive && activeProd2Tab === 'FREEZER',
      onClick: () => setProd2Tab('FREEZER')
    })
  }

  if (canSwitchAll || currentUser?.default_prod2_tab === 'SALES') {
    prod2CandidateItems.push({
      key: 'PRODUCTS',
      label: 'Produk',
      icon: ProductIcon,
      isActive: !isProfileActive && activeProd2Tab === 'PRODUCTS',
      onClick: () => setProd2Tab('PRODUCTS')
    })
  }

  prod2CandidateItems.push({
    key: 'LOGS',
    label: 'Riwayat',
    icon: LogIcon,
    isActive: !isProfileActive && activeProd2Tab === 'LOGS',
    onClick: () => setProd2Tab('LOGS')
  })

  // Pilih daftar dasar berdasarkan stage aktif
  const baseCandidates = activeProductionStage === 'PROD_2' ? prod2CandidateItems : prod1CandidateItems

  // Tab Profile selalu menjadi tab terakhir
  const profileTab = {
    key: 'PROFILE',
    label: 'Profil',
    isProfile: true,
    isActive: isProfileActive,
    onClick: () => openProfile()
  }

  // Hitung total tab jika ditampilkan utuh (+ 1 untuk Profile)
  const totalRawCount = baseCandidates.length + 1

  // Aturan Multi-Tab Grouping: Jika total item > 6, satukan stasiun kerja
  const finalNavItems =
    totalRawCount > 6
      ? (() => {
          const nonStationBefore = []
          const stationItems = []
          const nonStationAfter = []

          let reachedStation = false

          baseCandidates.forEach((item) => {
            if (item.group === 'stasiun') {
              reachedStation = true
              stationItems.push(item)
            } else if (!reachedStation) {
              nonStationBefore.push(item)
            } else {
              nonStationAfter.push(item)
            }
          })

          // Cari tahu stasiun yang sedang aktif saat ini
          const currentActiveStationItem = stationItems.find((s) => s.isActive)
          const isAnyStationActive = Boolean(currentActiveStationItem)

          const GroupIcon = currentActiveStationItem ? currentActiveStationItem.icon : LayoutGrid
          const groupLabel = currentActiveStationItem
            ? currentActiveStationItem.shortLabel || currentActiveStationItem.label
            : 'Stasiun'

          const stationGroupTab = {
            key: 'STATION_GROUP',
            label: groupLabel,
            icon: GroupIcon,
            isActive: isAnyStationActive,
            onClick: () => setIsStationSheetOpen(true)
          }

          return [...nonStationBefore, stationGroupTab, ...nonStationAfter, profileTab]
        })()
      : [...baseCandidates, profileTab]

  return (
    <>
      <nav
        aria-label="Navigasi Utama Bawah"
        className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] rounded-t-2xl shadow-[0_-4px_16px_rgba(44,62,80,0.04)] z-40 flex items-center justify-around min-h-[64px] pb-[env(safe-area-inset-bottom)] select-none"
      >
        {finalNavItems.map((tab) => {
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
                isActive
                  ? 'text-[#3A6B80]'
                  : 'text-[#556575] hover:text-[#2C3E50]'
              }`}
            >
              {/* Indikator aktif non-warna: garis atas terdefinisi */}
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
                <span className="flex items-center justify-center h-[24px]">
                  <Icon className="w-[22px] h-[22px] stroke-[2]" />
                </span>
              )}

              <span
                className={`text-[11px] leading-tight mt-0.5 tracking-tight truncate max-w-full px-0.5 ${
                  isActive ? 'font-bold text-[#3A6B80]' : 'font-medium text-[#556575]'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </nav>

      {/* Sheet Pemilihan Stasiun Produksi 1 (Jika Dikelompokkan) */}
      <StationSheet
        isOpen={isStationSheetOpen}
        onClose={() => setIsStationSheetOpen(false)}
        activeStation={activeStation}
        onSelectStation={(stId) => setStation(stId)}
      />
    </>
  )
}

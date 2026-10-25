import { useState, useEffect, useMemo } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortCustodyLogs, groupLotsByDay } from '../utils/dateFilter'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'
import {
  SendIcon,
  ReceiveIcon,
  MixerIcon,
  PlusIcon,
  WrapperIcon,
  AlertIcon,
  CheckIcon,
  BagIcon,
  FilterIcon,
  ClockIcon,
  SearchIcon,
  XIcon,
  RefreshIcon,
  ChevronDownIcon
} from './Icons'

// Kamus Nama Lengkap Operator dan PIC resmi pabrik
const OPERATOR_NAMES = {
  'OPR-DAGING': 'Budi Santoso',
  'PIC-DAGING': 'Pak Hendra (PIC)',
  'OPR-BUMBU': 'Agus Setiawan',
  'PIC-BUMBU': 'Pak Ilham (PIC)',
  'OPR-KULIT': 'Siti Rahma',
  'PIC-KULIT': 'Ibu Ratna (PIC)',
  'OPR-SAOS': 'Rian Hidayat',
  'PIC-SAOS': 'Pak Anwar (PIC)',
  'OPR-CETAK': 'Yanto Subekti',
  'PIC-CETAK': 'Pak Bowo (PIC)',
  'OPR-PACKING': 'Dewi Lestari',
  'PIC-PACKING': 'Ibu Maya (PIC)',
  'OPR-GUDANG': 'Hadi Prasetyo',
  'PIC-GUDANG': 'Pak Arif (PIC)',
  'STK-YOSI': 'Pak Yosi (PPIC)',
  'SYSTEM_API': 'Sistem'
}

function formatOperatorName(userId) {
  if (!userId) return 'Operator'
  const key = String(userId).trim().toUpperCase()
  return OPERATOR_NAMES[key] || userId
}

// Daftar Divisi untuk Filter PPIC & Supervisor
const DIVISION_TABS = [
  { id: 'ALL', label: 'Semua Divisi' },
  { id: 'MEAT', label: 'Giling & Mix' },
  { id: 'SEASONING', label: 'Bumbu' },
  { id: 'WRAPPER', label: 'Kulit Pangsit' },
  { id: 'SAUCE', label: 'Saos' },
  { id: 'ASSEMBLY', label: 'Meja Cetak' },
  { id: 'PACKING', label: 'Packing' }
]

// Chip Filter Cepat di Bawah Kolom Pencarian
const QUICK_FILTER_CHIPS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'WAITING_RECEIVE', label: 'Menunggu diterima' },
  { id: 'SCAN_OUT', label: 'Pengiriman' },
  { id: 'SCAN_IN', label: 'Penerimaan' },
  { id: 'PROD_PROCESS', label: 'Adonan dimix' },
  { id: 'QR_PRINTED', label: 'QR disiapkan' },
  { id: 'CONSUMED', label: 'Habis terpakai' }
]

// Pemformat nama stasiun ke bahasa Indonesia sehari-hari
function formatStationName(name, isShort = false) {
  if (!name) return ''
  const clean = String(name).trim().toUpperCase()

  const dict = {
    MEAT_STATION: isShort ? 'Daging' : 'Stasiun Daging',
    SEASONING_STATION: isShort ? 'Bumbu' : 'Stasiun Bumbu',
    WRAPPER_STATION: isShort ? 'Kulit' : 'Stasiun Kulit',
    SKIN_STATION: isShort ? 'Kulit' : 'Stasiun Kulit',
    SAUCE_STATION: isShort ? 'Saos' : 'Stasiun Saos',
    MEAT_MIXING_STATION: isShort ? 'Mixer' : 'Mixer Daging',
    GRINDING_STATION: isShort ? 'Mixer' : 'Mixer Daging',
    MIXING_STATION: isShort ? 'Mixer' : 'Mixer Daging',
    ASSEMBLY_STATION: isShort ? 'Cetak' : 'Bagian Cetak',
    FINISHING_STATION: isShort ? 'Finishing' : 'Finishing & Packing',
    PACKING_STATION: isShort ? 'Packing' : 'Bagian Packing'
  }

  if (dict[clean]) return dict[clean]

  const cleaned = clean.replace(/_STATION$/i, '').replace(/_/g, ' ')
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Format jam tanpa detik untuk daftar ringkas (contoh: 17.06)
function formatShortTime(timestampStr) {
  if (!timestampStr) return '--:--'
  const parts = String(timestampStr).split(/[:.]/)
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`
  }
  return String(timestampStr)
}

// Format nama plural jenis lot untuk grup aksi massal
function getItemPluralLabel(lotCode) {
  const code = String(lotCode || '').toUpperCase()
  if (code.startsWith('AD-')) return 'adonan'
  if (code.startsWith('DG-')) return 'wadah daging'
  if (code.startsWith('BM-') || code.startsWith('BS-')) return 'karung bumbu'
  if (code.startsWith('KL-')) return 'kemasan kulit'
  if (code.startsWith('SS-')) return 'bal saos'
  if (code.startsWith('TR-')) return 'tray'
  if (code.startsWith('FG-')) return 'produk jadi'
  return 'item'
}

// Konfigurasi Ikon & Tint Halus per Tipe Kejadian
function getEventIconConfig(actionType) {
  const act = String(actionType || '').toUpperCase()
  switch (act) {
    case 'SCAN_OUT':
      return { icon: SendIcon, tintBg: 'bg-[#EEF5F9]', tintText: 'text-[#4685ac]' }
    case 'SCAN_IN':
    case 'PULL_SCAN_IN':
      return { icon: ReceiveIcon, tintBg: 'bg-emerald-50', tintText: 'text-emerald-700' }
    case 'STOCK_IN':
      return { icon: CheckIcon, tintBg: 'bg-emerald-50', tintText: 'text-emerald-700' }
    case 'QR_PRINTED':
    case 'LOT_GENERATED':
      return { icon: PlusIcon, tintBg: 'bg-[#F5F1EB]', tintText: 'text-[#6B7B8D]' }
    case 'DOUGH_MIXED':
    case 'MIXING_COMPLETED':
      return { icon: MixerIcon, tintBg: 'bg-sky-50', tintText: 'text-sky-700' }
    case 'BUMBU_PORTION_CONSUMED':
      return { icon: BagIcon, tintBg: 'bg-amber-50', tintText: 'text-amber-800' }
    case 'WRAPPER_PREPARED':
      return { icon: WrapperIcon, tintBg: 'bg-amber-50', tintText: 'text-amber-700' }
    case 'CONSUMED':
    case 'MATERIAL_USED':
      return { icon: CheckIcon, tintBg: 'bg-[#F5F1EB]', tintText: 'text-[#2C3E50]' }
    case 'LOT_VOIDED':
    case 'VOIDED':
      return { icon: AlertIcon, tintBg: 'bg-rose-50', tintText: 'text-rose-600' }
    default:
      return { icon: ClockIcon, tintBg: 'bg-[#F5F1EB]', tintText: 'text-[#6B7B8D]' }
  }
}

// Kalimat Alami: satu fakta ditulis satu kali
function getNaturalDescription(log, operatorName, targetStationLabel) {
  const act = String(log.actionType || '').toUpperCase()
  const isAdonan = String(log.lotCode || '').startsWith('AD-')
  const notes = String(log.notes || '')

  switch (act) {
    case 'SCAN_OUT':
      return `Dikirim ke ${targetStationLabel} oleh ${operatorName}`
    case 'SCAN_IN':
    case 'PULL_SCAN_IN':
      return `Diterima di ${formatStationName(log.stationId, true)} oleh ${operatorName}`
    case 'QR_PRINTED':
    case 'LOT_GENERATED': {
      const match = notes.match(/(\d+)\/(\d+)/)
      if (isAdonan && match) {
        return `Label QR disiapkan (gilingan ${match[1]} dari ${match[2]}) oleh ${operatorName}`
      }
      return `Label QR disiapkan oleh ${operatorName}`
    }
    case 'STOCK_IN':
      return `Stok fisik dicek & masuk oleh ${operatorName}`
    case 'DOUGH_MIXED':
    case 'MIXING_COMPLETED':
      return `Adonan selesai dimix oleh ${operatorName}`
    case 'BUMBU_PORTION_CONSUMED':
      return `Bumbu racik dituang ke mixer oleh ${operatorName}`
    case 'WRAPPER_PREPARED':
      return `Kulit disiapkan oleh ${operatorName}`
    case 'CONSUMED':
    case 'MATERIAL_USED':
      if (isAdonan) return `Selesai dicetak jadi dimsum oleh ${operatorName}`
      return `Habis terpakai oleh ${operatorName}`
    case 'LOT_VOIDED':
    case 'VOIDED':
      return `Label dibatalkan oleh ${operatorName}`
    default:
      return `Aktivitas dicatat oleh ${operatorName}`
  }
}

export default function CustodyLogsView() {
  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isSupervisorUser = useProduction1Store((s) => s.isSupervisorUser)
  const employeeDateScope = useProduction1Store((s) => s.employeeDateScope)
  const rawLogs = useProduction1Store((s) => s.custodyLogs)
  const isSyncing = useProduction1Store((s) => s.isSyncing)
  const lastSyncedAt = useProduction1Store((s) => s.lastSyncedAt)
  const syncWithBackend = useProduction1Store((s) => s.syncWithBackend)

  const isSupervisor = Boolean(isSupervisorUser && isSupervisorUser())

  // Tentukan divisi default pengguna login
  const userDefaultDivision = useMemo(() => {
    if (!currentUser) return 'ALL'
    const st = currentUser.default_station || ''
    const tab = currentUser.default_prod2_tab || ''
    const div = (currentUser.division || '').toUpperCase()

    if (st === 'WRAPPER' || div.includes('KULIT') || div.includes('PANGSIT')) return 'WRAPPER'
    if (st === 'MEAT' || div.includes('DAGING') || div.includes('GILING')) return 'MEAT'
    if (st === 'SEASONING' || div.includes('BUMBU')) return 'SEASONING'
    if (st === 'SAUCE' || div.includes('SAOS')) return 'SAUCE'
    if (st === 'ASSEMBLY' || tab === 'INBOUND' || div.includes('CETAK')) return 'ASSEMBLY'
    if (st === 'PACKING' || tab === 'PACKING' || div.includes('PACKING')) return 'PACKING'
    if (st === 'SALES' || tab === 'SALES' || div.includes('GUDANG')) return 'SALES'
    return 'ALL'
  }, [currentUser])

  // Divisi aktif: Supervisor bisa pilih 'ALL', Karyawan terkunci ke divisinya
  const [supervisorDivision, setSupervisorDivision] = useState('ALL')
  const selectedDivision = isSupervisor ? supervisorDivision : userDefaultDivision

  // Filter & Search states
  const [sortOrder, setSortOrder] = useState('NEWEST_FIRST')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  // Accordion state untuk grup aksi massal yang terbuka
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set())

  // State untuk Bottom Sheet Perjalanan Lot Tunggal
  const [selectedLotForTimeline, setSelectedLotForTimeline] = useState(null)

  // Paginasi State (Diterapkan pada baris/grup terstruktur)
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  // Debounce input pencarian (300ms) tanpa tombol "Cari" terpisah
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Map Serah Terima: mendeteksi status SCAN_IN di stasiun tujuan
  const deliveryMap = useMemo(() => {
    const map = new Map()
    if (!Array.isArray(rawLogs)) return map

    rawLogs.forEach((lg) => {
      const act = String(lg.actionType || '').toUpperCase()
      if (act === 'SCAN_IN' || act === 'PULL_SCAN_IN') {
        const code = lg.lotCode
        if (code && !map.has(code)) {
          map.set(code, {
            isReceived: true,
            receiverId: lg.userId,
            receivedAt: lg.timestamp,
            stationId: lg.stationId
          })
        }
      }
    })

    return map
  }, [rawLogs])

  // Filter data mentah berdasarkan tanggal, divisi, aksi, dan kata kunci
  const filteredLogs = useMemo(() => {
    return filterAndSortCustodyLogs(rawLogs, {
      scope: employeeDateScope,
      userRole,
      division: selectedDivision,
      sortOrder,
      actionFilter,
      searchQuery,
      deliveryMap
    })
  }, [rawLogs, employeeDateScope, userRole, selectedDivision, sortOrder, actionFilter, searchQuery, deliveryMap])

  // Pengelompokan Aksi Massal (Client-side Grouping)
  // Syarat: aksi massal (≥ 2) berturut-turut dengan aktor, tipe aksi, rute, dan selisih waktu ≤ 60 detik.
  // Bila pencarian aktif: pengelompokan dilepas (flat) agar kode spesifik langsung tampil.
  const groupedActionLogs = useMemo(() => {
    if (!Array.isArray(filteredLogs) || filteredLogs.length === 0) return []
    if (searchQuery.trim().length > 0) {
      return filteredLogs.map((log) => ({ isGroup: false, ...log }))
    }

    const result = []
    let currentCluster = []

    const flushCluster = () => {
      if (currentCluster.length === 0) return
      if (currentCluster.length === 1) {
        result.push({ isGroup: false, ...currentCluster[0] })
      } else {
        const first = currentCluster[0]
        const groupId = `mass-${first.actionType}-${first.userId}-${first.logId || first.lotCode}`
        result.push({
          isGroup: true,
          groupId,
          actionType: first.actionType,
          stationId: first.stationId,
          targetStation: first.targetStation,
          userId: first.userId,
          userRole: first.userRole,
          timestamp: first.timestamp,
          rawTimestamp: first.rawTimestamp,
          createdAtIso: first.createdAtIso,
          items: currentCluster,
          count: currentCluster.length
        })
      }
      currentCluster = []
    }

    for (let i = 0; i < filteredLogs.length; i++) {
      const current = filteredLogs[i]
      if (currentCluster.length === 0) {
        currentCluster.push(current)
      } else {
        const prev = currentCluster[currentCluster.length - 1]
        const sameAction = String(prev.actionType).toUpperCase() === String(current.actionType).toUpperCase()
        const sameUser = String(prev.userId || '').toUpperCase() === String(current.userId || '').toUpperCase()
        const sameStation = String(prev.stationId || '').toUpperCase() === String(current.stationId || '').toUpperCase()
        const sameTarget = String(prev.targetStation || '').toUpperCase() === String(current.targetStation || '').toUpperCase()

        // Periksa kedekatan waktu (selisih ≤ 60 detik)
        const timePrev = prev.rawTimestamp ? new Date(prev.rawTimestamp).getTime() : 0
        const timeCurr = current.rawTimestamp ? new Date(current.rawTimestamp).getTime() : 0
        const diffSec = Math.abs(timeCurr - timePrev) / 1000
        const isTimeClose = timePrev && timeCurr ? diffSec <= 60 : prev.timestamp === current.timestamp

        if (sameAction && sameUser && sameStation && sameTarget && isTimeClose) {
          currentCluster.push(current)
        } else {
          flushCluster()
          currentCluster.push(current)
        }
      }
    }
    flushCluster()

    return result
  }, [filteredLogs, searchQuery])

  // Paginasi diterapkan pada hasil pengelompokan (sehingga 1 grup = 1 baris)
  const totalItems = groupedActionLogs.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return groupedActionLogs.slice(start, start + pageSize)
  }, [groupedActionLogs, safeCurrentPage, pageSize])

  // Pengelompokan Tanggal (Hari ini / Kemarin / Tanggal)
  const groupedByDay = useMemo(() => {
    return groupLotsByDay(paginatedLogs)
  }, [paginatedLogs])

  // Riwayat Perjalanan untuk Lot Terpilih (Lifecycle Stepper)
  const lotJourneyLogs = useMemo(() => {
    if (!selectedLotForTimeline || !Array.isArray(rawLogs)) return []
    return rawLogs
      .filter((l) => l.lotCode === selectedLotForTimeline)
      .sort((a, b) => {
        const tA = a.rawTimestamp ? new Date(a.rawTimestamp).getTime() : 0
        const tB = b.rawTimestamp ? new Date(b.rawTimestamp).getTime() : 0
        return tA - tB
      })
  }, [selectedLotForTimeline, rawLogs])

  const toggleGroupExpand = (groupId) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const isFilterActive =
    (isSupervisor && selectedDivision !== 'ALL') ||
    sortOrder !== 'NEWEST_FIRST' ||
    actionFilter !== 'ALL'

  const activeFilterCount =
    (isSupervisor && selectedDivision !== 'ALL' ? 1 : 0) +
    (sortOrder !== 'NEWEST_FIRST' ? 1 : 0) +
    (actionFilter !== 'ALL' ? 1 : 0)

  const handleResetFilter = () => {
    if (isSupervisor) setSupervisorDivision('ALL')
    setSortOrder('NEWEST_FIRST')
    setActionFilter('ALL')
    setSearchInput('')
    setSearchQuery('')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-3 pb-24 font-sans select-none">
      {/* 1. Header Ringkas & Status Kesegaran Data */}
      <div className="flex items-center justify-between px-0.5 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#2C3E50]">Riwayat aktivitas</span>
          {lastSyncedAt && (
            <span className="text-[11px] text-[#6B7B8D] font-medium tabular-nums">
              · Diperbarui {formatShortTime(lastSyncedAt)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => syncWithBackend()}
          disabled={isSyncing}
          className="h-8 px-2.5 rounded-lg border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] active:scale-95 text-[#2C3E50] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          title="Sinkronkan data terbaru dari server"
          aria-label="Segarkan data"
        >
          <RefreshIcon className={`w-3.5 h-3.5 text-[#6B7B8D] ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="text-[11px]">Segarkan</span>
        </button>
      </div>

      {/* 2. Toolbar Pencarian Otomatis & Tombol Filter */}
      <div className="flex items-center gap-2">
        {/* Kolom Pencarian Langsung (Debounce 300ms) */}
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7B8D] pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari kode atau operator..."
            className="w-full text-xs pl-8 pr-8 py-2.5 bg-white border border-[#EDE8DF] rounded-xl text-[#2C3E50] placeholder-[#6B7B8D] focus:outline-none focus:bg-white focus:border-[#4685ac] focus:ring-1 focus:ring-[#4685ac] transition shadow-2xs"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearchQuery('')
                setCurrentPage(1)
              }}
              className="w-7 h-7 absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] text-xs cursor-pointer rounded-lg hover:bg-[#EDE8DF]/60 transition"
              aria-label="Hapus teks pencarian"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tombol Filter dengan Badge Indikator Jumlah Filter Aktif */}
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0 shadow-2xs ${
            isFilterActive
              ? 'bg-[#EEF5F9] border-[#4685ac] text-[#4685ac]'
              : 'bg-white border-[#EDE8DF] text-[#2C3E50] hover:bg-[#F5F1EB]'
          }`}
          title="Buka pengaturan filter"
          aria-label="Buka filter lanjutan"
        >
          <FilterIcon className="w-3.5 h-3.5" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#4685ac] text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Baris Chip Jalan Pintas (Scroll Horizontal) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
        {QUICK_FILTER_CHIPS.map((chip) => {
          const isActive = actionFilter === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setActionFilter(chip.id)
                setCurrentPage(1)
              }}
              className={`h-8 px-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition active:scale-95 border ${
                isActive
                  ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-xs'
                  : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB] hover:text-[#2C3E50]'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* 4. Tag Filter Aktif yang Dapat Dihapus Satuan */}
      {isFilterActive && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {isSupervisor && selectedDivision !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EDE8DF] text-[11px] text-[#2C3E50] font-medium">
              <span>Divisi: {DIVISION_TABS.find((d) => d.id === selectedDivision)?.label || selectedDivision}</span>
              <button
                type="button"
                onClick={() => setSupervisorDivision('ALL')}
                className="hover:text-rose-600 cursor-pointer"
                aria-label="Hapus filter divisi"
              >
                ✕
              </button>
            </span>
          )}

          {actionFilter !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EDE8DF] text-[11px] text-[#2C3E50] font-medium">
              <span>Aksi: {QUICK_FILTER_CHIPS.find((c) => c.id === actionFilter)?.label || actionFilter}</span>
              <button
                type="button"
                onClick={() => setActionFilter('ALL')}
                className="hover:text-rose-600 cursor-pointer"
                aria-label="Hapus filter aksi"
              >
                ✕
              </button>
            </span>
          )}

          {sortOrder !== 'NEWEST_FIRST' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EDE8DF] text-[11px] text-[#2C3E50] font-medium">
              <span>Urutan: Terlama</span>
              <button
                type="button"
                onClick={() => setSortOrder('NEWEST_FIRST')}
                className="hover:text-rose-600 cursor-pointer"
                aria-label="Hapus urutan terlama"
              >
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilter}
            className="text-[11px] font-semibold text-[#4685ac] hover:underline cursor-pointer py-1 px-1.5"
          >
            Hapus semua
          </button>
        </div>
      )}

      {/* 5. Daftar Riwayat Aktivitas */}
      {isSyncing && rawLogs.length === 0 ? (
        /* Skeleton Loader saat data pertama kali dimuat */
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[74px] bg-white border border-[#EDE8DF] rounded-2xl p-3 flex items-center justify-between animate-pulse shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#EDE8DF]" />
                <div className="space-y-2">
                  <div className="w-28 h-3.5 bg-[#EDE8DF] rounded-md" />
                  <div className="w-44 h-3 bg-[#EDE8DF]/60 rounded-md" />
                </div>
              </div>
              <div className="space-y-2 flex flex-col items-end">
                <div className="w-10 h-3 bg-[#EDE8DF] rounded-md" />
                <div className="w-16 h-4 bg-[#EDE8DF]/80 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : totalItems === 0 ? (
        /* State Kosong / Tidak Ada Hasil */
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] space-y-3 shadow-2xs mt-2">
          <p className="font-medium text-[#2C3E50]">
            {isFilterActive || searchQuery
              ? 'Tidak ada aktivitas yang sesuai dengan filter atau kata kunci pencarian.'
              : 'Belum ada riwayat aktivitas untuk divisi ini.'}
          </p>
          {(isFilterActive || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="inline-flex items-center min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#4685ac] text-white hover:bg-[#3A6B80] cursor-pointer transition shadow-2xs active:scale-95"
            >
              Reset pencarian & filter
            </button>
          )}
        </div>
      ) : (
        /* Daftar Berkelompok per Tanggal */
        <div className="space-y-4">
          {groupedByDay.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Header Tanggal Sticky Bersih & Ringkas */}
              <div className="sticky top-[58px] sm:top-[64px] z-10 bg-[#FAF7F2]/95 backdrop-blur-xs py-1.5 px-0.5 border-b border-[#EDE8DF]/70 flex items-center justify-between">
                <span className="text-xs font-bold text-[#2C3E50]">{group.label}</span>
                <span className="text-[11px] text-[#6B7B8D] tabular-nums font-medium">
                  {group.items.length} aktivitas
                </span>
              </div>

              {/* Baris Kartu Riwayat */}
              <div className="space-y-2">
                {group.items.map((entry, index) => {
                  /* KASUS A: Grup Aksi Massal */
                  if (entry.isGroup) {
                    const isExpanded = expandedGroupIds.has(entry.groupId)
                    const iconConfig = getEventIconConfig(entry.actionType)
                    const IconComponent = iconConfig.icon
                    const operatorName = formatOperatorName(entry.userId)
                    const targetStationLabel = formatStationName(entry.targetStation, true)
                    const itemLabel = getItemPluralLabel(entry.items[0]?.lotCode)

                    // Hitung status penerimaan agregat
                    const receivedCount = entry.items.filter(
                      (it) => deliveryMap.get(it.lotCode)?.isReceived
                    ).length

                    let groupBadgeVariant
                    let groupBadgeText
                    if (entry.actionType === 'SCAN_OUT') {
                      if (receivedCount === entry.count) {
                        groupBadgeVariant = 'success'
                        groupBadgeText = `Diterima (${entry.count})`
                      } else if (receivedCount === 0) {
                        groupBadgeVariant = 'warning'
                        groupBadgeText = `Menunggu (${entry.count})`
                      } else {
                        groupBadgeVariant = 'warning'
                        groupBadgeText = `${receivedCount}/${entry.count} diterima`
                      }
                    } else if (entry.actionType === 'QR_PRINTED') {
                      groupBadgeVariant = 'neutral'
                      groupBadgeText = `QR dicetak (${entry.count})`
                    } else if (entry.actionType === 'CONSUMED') {
                      groupBadgeVariant = 'neutral'
                      groupBadgeText = `Habis terpakai (${entry.count})`
                    } else if (entry.actionType === 'DOUGH_MIXED') {
                      groupBadgeVariant = 'info'
                      groupBadgeText = `Selesai mix (${entry.count})`
                    } else {
                      groupBadgeVariant = 'neutral'
                      groupBadgeText = `${entry.count} item`
                    }

                    return (
                      <div
                        key={entry.groupId || index}
                        className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs space-y-2 transition-all hover:border-[#D5CEBF]"
                      >
                        {/* Baris Utama Grup */}
                        <div
                          onClick={() => toggleGroupExpand(entry.groupId)}
                          className="flex items-center justify-between gap-2.5 cursor-pointer"
                        >
                          {/* Sisi Kiri: Ikon Lingkaran Bertint + Teks Ringkas */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-full ${iconConfig.tintBg} ${iconConfig.tintText} flex items-center justify-center shrink-0`}
                            >
                              <IconComponent className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-xs text-[#2C3E50] block truncate">
                                {entry.actionType === 'SCAN_OUT'
                                  ? `${entry.count} ${itemLabel} dikirim ke ${targetStationLabel}`
                                  : entry.actionType === 'QR_PRINTED'
                                  ? `${entry.count} label ${itemLabel} disiapkan`
                                  : entry.actionType === 'CONSUMED'
                                  ? `${entry.count} ${itemLabel} selesai dicetak jadi dimsum`
                                  : `${entry.count} ${itemLabel} diproses`}
                              </span>
                              <span className="text-[11px] text-[#6B7B8D] block truncate">
                                oleh {operatorName}
                              </span>
                            </div>
                          </div>

                          {/* Sisi Kanan: Jam Ringkas & Badge Agregat */}
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <span className="text-[11px] text-[#6B7B8D] tabular-nums font-medium">
                              {formatShortTime(entry.timestamp)}
                            </span>
                            <div className="flex items-center gap-1">
                              <Badge variant={groupBadgeVariant} size="sm">
                                {groupBadgeText}
                              </Badge>
                              <ChevronDownIcon
                                className={`w-3.5 h-3.5 text-[#6B7B8D] transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[#2C3E50]' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Accordion Isi Kode Lot di dalam Grup */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-[#EDE8DF] animate-in fade-in duration-100 space-y-1.5">
                            <span className="text-[10px] text-[#6B7B8D] font-medium block">
                              Daftar kode lot (tekan untuk melihat riwayat perjalanan):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {entry.items.map((it) => {
                                const delivery = deliveryMap.get(it.lotCode)
                                const isReceived = delivery?.isReceived
                                return (
                                  <button
                                    key={it.lotCode}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedLotForTimeline(it.lotCode)
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums border bg-[#FAF7F2] hover:bg-[#F5F1EB] active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <span className="text-[#2C3E50]">{it.lotCode}</span>
                                    {entry.actionType === 'SCAN_OUT' && (
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isReceived ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                        title={isReceived ? 'Sudah diterima' : 'Menunggu diterima'}
                                      />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                  /* KASUS B: Baris Kejadian Tunggal */
                  const log = entry
                  const iconConfig = getEventIconConfig(log.actionType)
                  const IconComponent = iconConfig.icon
                  const operatorName = formatOperatorName(log.userId)
                  const deliveryInfo = log.actionType === 'SCAN_OUT' ? deliveryMap.get(log.lotCode) : null
                  const targetStationLabel = formatStationName(
                    log.targetStation || deliveryInfo?.stationId || 'Divisi Tujuan',
                    true
                  )
                  const naturalDesc = getNaturalDescription(log, operatorName, targetStationLabel)

                  // Badge semantik tunggal
                  let badgeVariant
                  let badgeText
                  const act = String(log.actionType || '').toUpperCase()

                  if (act === 'SCAN_OUT') {
                    if (deliveryInfo) {
                      badgeVariant = 'success'
                      badgeText = 'Diterima'
                    } else {
                      badgeVariant = 'warning'
                      badgeText = 'Menunggu diterima'
                    }
                  } else if (act === 'SCAN_IN' || act === 'PULL_SCAN_IN' || act === 'STOCK_IN') {
                    badgeVariant = 'success'
                    badgeText = 'Diterima'
                  } else if (act === 'CONSUMED' || act === 'MATERIAL_USED') {
                    badgeVariant = 'neutral'
                    badgeText = 'Habis terpakai'
                  } else if (act === 'QR_PRINTED' || act === 'LOT_GENERATED') {
                    badgeVariant = 'neutral'
                    badgeText = 'QR dicetak'
                  } else if (act === 'DOUGH_MIXED' || act === 'MIXING_COMPLETED') {
                    badgeVariant = 'info'
                    badgeText = 'Selesai mix'
                  } else if (act === 'BUMBU_PORTION_CONSUMED') {
                    badgeVariant = 'info'
                    badgeText = 'Bumbu dituang'
                  } else if (act === 'WRAPPER_PREPARED') {
                    badgeVariant = 'info'
                    badgeText = 'Kulit siap'
                  } else if (act === 'LOT_VOIDED' || act === 'VOIDED') {
                    badgeVariant = 'danger'
                    badgeText = 'Dibatalkan'
                  } else {
                    badgeVariant = 'neutral'
                    badgeText = 'Tercatat'
                  }

                  return (
                    <div
                      key={log.logId || index}
                      onClick={() => setSelectedLotForTimeline(log.lotCode)}
                      className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-2.5 transition-all hover:border-[#D5CEBF] active:scale-[0.99] cursor-pointer"
                    >
                      {/* Sisi Kiri: Ikon Lingkaran Bertint + Kode Tebal & Kalimat Alami */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-full ${iconConfig.tintBg} ${iconConfig.tintText} flex items-center justify-center shrink-0`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-[#2C3E50] block tabular-nums truncate">
                            {log.lotCode}
                          </span>
                          <span className="text-[11px] text-[#6B7B8D] block truncate mt-0.5">
                            {naturalDesc}
                          </span>
                        </div>
                      </div>

                      {/* Sisi Kanan: Jam Ringkas (17.06) & Satu Badge Semantik */}
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-[11px] text-[#6B7B8D] tabular-nums font-medium">
                          {formatShortTime(log.timestamp)}
                        </span>
                        <Badge variant={badgeVariant} size="sm">
                          {badgeText}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 6. Kontrol Paginasi Bersih */}
          {totalPages > 1 && (
            <div className="mt-4 pt-3 border-t border-[#EDE8DF] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7B8D]">
                <span>Tampilkan:</span>
                {[15, 25, 50].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz)
                      setCurrentPage(1)
                    }}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition ${
                      pageSize === sz
                        ? 'bg-[#4685ac] text-white border-[#4685ac]'
                        : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-9 px-3 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] hover:bg-[#F5F1EB] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition active:scale-95 shadow-2xs"
                >
                  Sebelumnya
                </button>

                <span className="text-xs font-bold tabular-nums text-[#2C3E50] px-1">
                  {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 px-3 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] hover:bg-[#F5F1EB] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition active:scale-95 shadow-2xs"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Modal Bottom-Sheet Filter Lanjutan */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filter & urutkan riwayat"
        subtitle="Atur kriteria data aktivitas yang ditampilkan"
        size="sm"
      >
        <div className="space-y-4">
          {/* Pilihan Divisi (Khusus PPIC / Supervisor) */}
          {isSupervisor && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2C3E50] block">
                Divisi produksi
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {DIVISION_TABS.map((tab) => {
                  const isSelected = selectedDivision === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSupervisorDivision(tab.id)
                        setCurrentPage(1)
                      }}
                      className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold transition text-left cursor-pointer border truncate ${
                        isSelected
                          ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                          : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Urutan Waktu */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2C3E50] block">
              Urutan waktu
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSortOrder('NEWEST_FIRST')
                  setCurrentPage(1)
                }}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer border ${
                  sortOrder === 'NEWEST_FIRST'
                    ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                    : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                }`}
              >
                Terbaru dahulu
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortOrder('OLDEST_FIRST')
                  setCurrentPage(1)
                }}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer border ${
                  sortOrder === 'OLDEST_FIRST'
                    ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                    : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                }`}
              >
                Terlama dahulu
              </button>
            </div>
          </div>

          {/* Tombol Aksi Modal */}
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8DF] gap-2">
            <button
              type="button"
              onClick={handleResetFilter}
              className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[#6B7B8D] hover:text-[#2C3E50] cursor-pointer transition rounded-xl"
            >
              Reset default
            </button>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-[#4685ac] text-white hover:bg-[#3A6B80] cursor-pointer shadow-xs transition active:scale-95"
            >
              Selesai
            </button>
          </div>
        </div>
      </Modal>

      {/* 8. Bottom Sheet Perjalanan Lengkap Satu Kode (Lifecycle Timeline) */}
      <Modal
        isOpen={Boolean(selectedLotForTimeline)}
        onClose={() => setSelectedLotForTimeline(null)}
        title="Perjalanan lot"
        subtitle={selectedLotForTimeline || ''}
        size="md"
      >
        {selectedLotForTimeline && (
          <div className="space-y-4">
            <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#EDE8DF] flex items-center justify-between text-xs">
              <span className="font-bold text-[#2C3E50] tabular-nums">
                {selectedLotForTimeline}
              </span>
              <span className="text-[#6B7B8D]">
                {getItemPluralLabel(selectedLotForTimeline).toUpperCase()}
              </span>
            </div>

            {/* Stepper Vertikal Kronologis */}
            <div className="space-y-0 relative pl-4 border-l-2 border-[#EDE8DF] ml-2">
              {lotJourneyLogs.length === 0 ? (
                <div className="text-xs text-[#6B7B8D] py-4 text-center">
                  Data detail perjalanan belum tercatat di log audit.
                </div>
              ) : (
                lotJourneyLogs.map((step, idx) => {
                  const iconConfig = getEventIconConfig(step.actionType)
                  const IconComp = iconConfig.icon
                  const opName = formatOperatorName(step.userId)
                  const targetLabel = formatStationName(step.targetStation, true)
                  const stepText = getNaturalDescription(step, opName, targetLabel)
                  const isLatest = idx === lotJourneyLogs.length - 1

                  return (
                    <div key={step.logId || idx} className="relative pb-5 last:pb-1">
                      {/* Titik Lingkaran Timeline */}
                      <div
                        className={`absolute -left-[25px] top-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                          isLatest ? 'bg-[#4685ac] text-white' : 'bg-[#EDE8DF] text-[#6B7B8D]'
                        }`}
                      >
                        <IconComp className="w-3 h-3" />
                      </div>

                      <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] gap-2">
                          <span className="font-bold text-[#2C3E50]">{stepText}</span>
                          <span className="text-[#6B7B8D] tabular-nums shrink-0">
                            {step.timestamp || '--:--'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#6B7B8D]">
                          <span>
                            Lokasi: {formatStationName(step.stationId, true)}
                            {step.targetStation ? ` → ${targetLabel}` : ''}
                          </span>
                          <span className="tabular-nums font-medium text-[#2C3E50]">
                            {step.userId}
                          </span>
                        </div>

                        {step.notes && (
                          <div className="text-[10px] text-[#6B7B8D] bg-[#FAF7F2] rounded-md px-2 py-1 mt-1 border border-[#EDE8DF]/60">
                            {step.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedLotForTimeline(null)}
                className="w-full min-h-[44px] rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-xs font-semibold text-[#2C3E50] cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

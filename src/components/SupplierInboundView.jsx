import { useState, useEffect, useCallback, useMemo } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { exportSupplierInboundExcel } from '../utils/excelExport'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'
import { CustomSelect } from './ui/CustomSelect'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { ListRowSkeleton } from './ui/Skeleton'
import {
  SearchIcon,
  FilterIcon,
  XIcon,
  RefreshIcon,
  CheckIcon,
  AlertIcon
} from './Icons'
import { FileSpreadsheet, NotebookPen, QrCode } from 'lucide-react'

const INBOUND_CATEGORIES = [
  { id: 'KULIT', label: 'Kulit Dimsum' },
  { id: 'DAGING', label: 'Daging Mentah' },
  { id: 'BUMBU', label: 'Bumbu & Minyak' },
  { id: 'SAOS', label: 'Saos Kemasan' },
  { id: 'KEMASAN', label: 'Kemasan & Plastik' },
  { id: 'LAINNYA', label: 'Lainnya' }
]

const UNIT_OPTIONS = [
  { value: 'BAL', label: 'BAL' },
  { value: 'KG', label: 'KG' },
  { value: 'KARUNG', label: 'KARUNG', selectedLabel: 'KRG' },
  { value: 'DUS', label: 'DUS' },
  { value: 'PACK', label: 'PACK' },
  { value: 'PCS', label: 'PCS' }
]
const VALID_UNITS = UNIT_OPTIONS.map((u) => u.value)
const formatUnitDisplay = (u) => (u === 'KARUNG' ? 'KRG' : (u || ''))
const EMPTY_INBOUND_LIST = []

const getTodayStr = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getYesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatIndoDate(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return dStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const day = parseInt(parts[2], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${months[monthIdx] || parts[1]} ${year}`
}

function formatIndoDateFull(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return dStr
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const day = parseInt(parts[2], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${months[monthIdx] || parts[1]} ${year}`
}

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function getIndoDayName(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return ''
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
  return INDO_DAYS[d.getDay()] || ''
}

function formatItemTime(isoStr) {
  if (!isoStr) return ''
  try {
    const s = String(isoStr)
    const normalized = s.endsWith('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z'
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') + ' WIB'
  } catch {
    return ''
  }
}

export default function SupplierInboundView() {
  // Modal Pop up State & Scroll Lock
  const [isModalOpen, setIsModalOpen] = useState(false)
  useLockBodyScroll(isModalOpen)

  // Tab Filter Utama (Gambar 1: Persis seperti Riwayat / Logs)
  const [activeTab, setActiveTab] = useState('ALL') // 'ALL' | 'INBOUND' | 'OUTBOUND' | 'INVENTORY'
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  // Filter Kategori & Tanggal (Default: 'recent' = Hari Ini & Kemarin agar pergantian hari 00:00 tidak mengosongkan data)
  const [filterCategory, setFilterCategory] = useState('ALL') // 'ALL' | 'KULIT' | 'DAGING' | ...
  const [filterPreset, setFilterPreset] = useState('recent') // 'recent' | 'today' | 'yesterday' | 'single' | 'range' | 'all'
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [rangeStartDate, setRangeStartDate] = useState(getYesterdayStr())
  const [rangeEndDate, setRangeEndDate] = useState(getTodayStr())

  // Form State Modal Catat Barang Masuk (Awalnya kosong tanpa nilai default)
  const [category, setCategory] = useState('')
  const [skinVariant, setSkinVariant] = useState('') // '9CM' | '7CM'
  const [sauceVariant, setSauceVariant] = useState('') // 'MIKA' | 'VAKUM'
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [documentNo, setDocumentNo] = useState('')
  const [notes, setNotes] = useState('')
  const [needPrintQr, setNeedPrintQr] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)
  const [isLoadingInbound, setIsLoadingInbound] = useState(true)
  const [formError, setFormError] = useState('')
  const [toastSuccess, setToastSuccess] = useState('')

  // Store
  const planDetailMode = useProduction1Store((s) => s.planDetailMode) || 'GENERAL'
  const isDetailed = planDetailMode === 'DETAILED'

  const rawSupplierInboundList = useProduction1Store((s) => s.supplierInboundList)
  const supplierInboundList = rawSupplierInboundList || EMPTY_INBOUND_LIST
  const fetchSupplierInbound = useProduction1Store((s) => s.fetchSupplierInbound)
  const createSupplierInbound = useProduction1Store((s) => s.createSupplierInbound)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)

  const isRange = filterPreset === 'range'

  const activePeriodLabel = isRange
    ? `${formatIndoDate(rangeStartDate)} – ${formatIndoDate(rangeEndDate)}`
    : filterPreset === 'recent'
      ? 'Hari Ini & Kemarin'
      : filterPreset === 'today'
        ? `Hari Ini (${formatIndoDate(selectedDate)})`
        : filterPreset === 'yesterday'
          ? `Kemarin (${formatIndoDate(selectedDate)})`
          : filterPreset === 'all'
            ? 'Semua Waktu'
            : formatIndoDateFull(selectedDate)

  const activeExportDateStr = isRange
    ? `${rangeStartDate} s/d ${rangeEndDate}`
    : filterPreset === 'recent'
      ? `${getYesterdayStr()} s/d ${getTodayStr()}`
      : filterPreset === 'all'
        ? 'Semua'
        : selectedDate

  const isFilterActive = filterCategory !== 'ALL' || filterPreset !== 'recent'
  const activeFilterCount = (filterCategory !== 'ALL' ? 1 : 0) + (filterPreset !== 'recent' ? 1 : 0)

  const loadInboundData = useCallback(async () => {
    setIsLoadingInbound(true)
    try {
      const catParam = filterCategory === 'ALL' ? null : filterCategory
      if (filterPreset === 'recent') {
        await fetchSupplierInbound(getYesterdayStr(), catParam, getTodayStr())
      } else if (filterPreset === 'range') {
        await fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
      } else if (filterPreset === 'all') {
        await fetchSupplierInbound(null, catParam, null, true)
      } else {
        await fetchSupplierInbound(selectedDate, catParam)
      }
    } finally {
      setIsLoadingInbound(false)
    }
  }, [fetchSupplierInbound, filterPreset, filterCategory, rangeStartDate, rangeEndDate, selectedDate])

  useEffect(() => {
    loadInboundData()
  }, [loadInboundData])

  const applyPreset = (preset) => {
    setFilterPreset(preset)
    const catParam = filterCategory === 'ALL' ? null : filterCategory
    if (preset === 'recent') {
      const t = getTodayStr()
      const y = getYesterdayStr()
      setSelectedDate(t)
      setRangeStartDate(y)
      setRangeEndDate(t)
      fetchSupplierInbound(y, catParam, t)
    } else if (preset === 'today') {
      const t = getTodayStr()
      setSelectedDate(t)
      fetchSupplierInbound(t, catParam)
    } else if (preset === 'yesterday') {
      const y = getYesterdayStr()
      setSelectedDate(y)
      fetchSupplierInbound(y, catParam)
    } else if (preset === 'single') {
      fetchSupplierInbound(selectedDate, catParam)
    } else if (preset === 'range') {
      fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
    } else if (preset === 'all') {
      fetchSupplierInbound(null, catParam, null, true)
    }
  }

  const handleFilterCategoryChange = (catId) => {
    setFilterCategory(catId)
    const catParam = catId === 'ALL' ? null : catId
    if (filterPreset === 'recent') {
      fetchSupplierInbound(getYesterdayStr(), catParam, getTodayStr())
    } else if (filterPreset === 'range') {
      fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
    } else if (filterPreset === 'all') {
      fetchSupplierInbound(null, catParam, null, true)
    } else {
      fetchSupplierInbound(selectedDate, catParam)
    }
  }

  const handleResetFilter = () => {
    setFilterCategory('ALL')
    setFilterPreset('recent')
    const t = getTodayStr()
    const y = getYesterdayStr()
    setSelectedDate(t)
    setRangeStartDate(y)
    setRangeEndDate(t)
    fetchSupplierInbound(y, null, t)
  }

  // Handler Perubahan Kategori Form Modal
  const handleCategoryChange = (newCat) => {
    setCategory(newCat)
    setSkinVariant('')
    setSauceVariant('')
    setFormError('')

    if (newCat === 'KULIT') {
      if (isDetailed) {
        setItemName('')
      } else {
        setItemName('Kulit Dimsum')
        if (!unit) setUnit('BAL')
      }
    } else if (newCat === 'SAOS') {
      if (isDetailed) {
        setItemName('')
      } else {
        setItemName('Saos Dimsum')
        if (!unit) setUnit('BAL')
      }
    } else if (newCat === 'DAGING') {
      setItemName('Daging Ayam Paha Fillet')
      if (!unit) setUnit('KG')
    } else if (newCat === 'BUMBU') {
      setItemName('Bumbu Sparta Racik')
      if (!unit) setUnit('KARUNG')
    } else if (newCat === 'KEMASAN') {
      setItemName('Mika Dimsum Isi 50')
      if (!unit) setUnit('DUS')
    } else {
      setItemName('')
      if (!unit) setUnit('PCS')
    }
  }

  const handleSkinVariantSelect = (variant) => {
    setSkinVariant(variant)
    setFormError('')
    if (variant === '9CM') {
      setItemName('Kulit Dimsum 9 cm (Mika)')
    } else {
      setItemName('Kulit Dimsum 7 cm (Vakum)')
    }
    if (!unit) setUnit('BAL')
  }

  const handleSauceVariantSelect = (variant) => {
    setSauceVariant(variant)
    setFormError('')
    if (variant === 'MIKA') {
      setItemName('Saos Mika')
    } else {
      setItemName('Saos Vakum')
    }
    if (!unit) setUnit('BAL')
  }

  const handleQuantityChange = (val) => {
    setFormError('')
    // Sanitasi: hanya angka dan satu titik desimal
    const cleaned = val.replace(/[^0-9.]/g, '')
    setQuantity(cleaned)
  }

  // Buka Modal & Inisialisasi Form Kosong Bersih
  const openModal = () => {
    setCategory('')
    setSkinVariant('')
    setSauceVariant('')
    setItemName('')
    setQuantity('')
    setUnit('')
    setSupplierName('')
    setDocumentNo('')
    setNotes('')
    setNeedPrintQr(false)
    setFormError('')
    setIsModalOpen(true)
  }

  // Submit Form Ketat (Strict Margin of Error)
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setFormError('')

    // 1. Validasi Kategori
    if (!category) {
      setFormError('Pilih kategori barang terlebih dahulu.')
      return
    }

    // 2. Validasi Sub-pilihan jika mode Spesifik aktif
    if (isDetailed) {
      if (category === 'KULIT' && !skinVariant) {
        setFormError('Pilih ukuran kulit (9cm atau 7cm).')
        return
      }
      if (category === 'SAOS' && !sauceVariant) {
        setFormError('Pilih varian saos (Mika atau Vakum).')
        return
      }
    }

    // 3. Validasi Nama Barang
    const cleanName = itemName.trim()
    if (!cleanName || cleanName.length < 2) {
      setFormError('Nama barang wajib diisi minimal 2 karakter.')
      return
    }

    // 4. Validasi Jumlah (Strict Positive Number)
    const numQty = parseFloat(quantity)
    if (isNaN(numQty) || numQty <= 0) {
      setFormError('Jumlah barang harus berupa angka lebih dari 0.')
      return
    }

    // 5. Validasi Satuan
    if (!unit || !VALID_UNITS.includes(unit)) {
      setFormError('Pilih satuan barang terlebih dahulu.')
      return
    }

    // 6. Validasi Supplier
    const cleanSupplier = supplierName.trim()
    if (!cleanSupplier || cleanSupplier.length < 2) {
      setFormError('Nama supplier wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const created = await createSupplierInbound({
        category,
        item_name: cleanName,
        quantity: numQty,
        unit,
        supplier_name: cleanSupplier,
        document_no: documentNo.trim() || null,
        notes: notes.trim() || null,
        received_by: operatorName || operatorId || 'PPIC-AYU'
      })

      // Micro-interaction: Tampilkan Centang Sukses sebelum tutup modal
      setIsSubmitSuccess(true)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40)
        }
      } catch {
        // ignore
      }

      // Jeda 600ms untuk konfirmasi emosional pengguna
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Tutup modal & tampilkan feedback
      setIsModalOpen(false)
      setIsSubmitSuccess(false)
      setToastSuccess(`Barang masuk "${cleanName}" (${numQty} ${formatUnitDisplay(unit)}) berhasil dicatat.`)
      setTimeout(() => setToastSuccess(''), 4000)

      // Muat ulang data
      loadInboundData()

      // Buka modal cetak QR jika toggle aktif
      if (needPrintQr) {
        const todayCode = getTodayStr().replace(/-/g, '')
        const catPrefix = category === 'KULIT' ? 'KL'
          : category === 'DAGING' ? 'DG'
          : category === 'BUMBU' ? 'BM'
          : category === 'SAOS' ? 'SA'
          : category === 'KEMASAN' ? 'KM'
          : 'SP'
        const rawId = created?.inbound_id || Math.floor(Date.now() / 1000) % 1000
        const idStr = String(rawId).padStart(3, '0')
        const baseCode = `IN-${catPrefix}-${todayCode}-${idStr}`

        const isIntQty = Number.isInteger(numQty) && numQty >= 1 && numQty <= 50
        const count = isIntQty ? Math.floor(numQty) : 1
        const printItems = []
        for (let i = 1; i <= count; i++) {
          const itemCode = count > 1 ? `${baseCode}-${String(i).padStart(2, '0')}` : baseCode
          printItems.push({
            lotCode: itemCode,
            title: `BARANG MASUK: ${cleanName.toUpperCase()}`,
            detail: `${cleanSupplier} · ${count > 1 ? `Unit ${i}/${count} (${formatUnitDisplay(unit)})` : `${numQty} ${formatUnitDisplay(unit)}`}`,
            weight: count > 1 ? `1 ${formatUnitDisplay(unit)}` : `${numQty} ${formatUnitDisplay(unit)}`,
            supplierName: cleanSupplier,
            createdAt: new Date().toISOString()
          })
        }

        openBatchPrintModal(printItems, `BARANG MASUK: ${cleanName.toUpperCase()}`)
      }
    } catch (err) {
      setFormError(err?.message || 'Gagal menyimpan barang masuk ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExportExcel = () => {
    exportSupplierInboundExcel({
      dateStr: activeExportDateStr,
      inboundList: supplierInboundList,
      operatorName: operatorName || 'Ayu (PPIC)'
    })
  }

  // Filter daftar transaksi barang masuk berdasarkan query pencarian, kategori, dan tab
  const filteredInboundList = useMemo(() => {
    let list = supplierInboundList
    if (filterCategory !== 'ALL') {
      list = list.filter((it) => it.category?.toUpperCase() === filterCategory.toUpperCase())
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (it) =>
          it.item_name?.toLowerCase().includes(q) ||
          it.supplier_name?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.document_no?.toLowerCase().includes(q)
      )
    }
    return list
  }, [supplierInboundList, filterCategory, searchQuery])

  // Kelompokkan daftar transaksi barang masuk berdasarkan tanggal (divide beda hari)
  const groupedInboundByDate = useMemo(() => {
    const today = getTodayStr()
    const yesterday = getYesterdayStr()

    const map = new Map()
    for (const item of filteredInboundList) {
      const d = item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : today)
      if (!map.has(d)) {
        map.set(d, [])
      }
      map.get(d).push(item)
    }

    // Jika filter preset 'recent' dan tidak sedang mencari teks,
    // tampilkan slot 'Hari Ini' agar PPIC melihat dengan jelas pembagian hari ini vs kemarin
    if (filterPreset === 'recent' && !searchQuery.trim() && !map.has(today)) {
      map.set(today, [])
    }

    // Urutkan tanggal menurun (terbaru di atas)
    const sortedDates = Array.from(map.keys()).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))

    return sortedDates.map((dateStr) => {
      const items = map.get(dateStr) || []
      const isToday = dateStr === today
      const isYesterday = dateStr === yesterday

      let badgeLabel = ''
      let title = ''

      if (isToday) {
        badgeLabel = 'Hari Ini'
        const dayName = getIndoDayName(dateStr)
        title = dayName ? `${dayName}, ${formatIndoDate(dateStr)}` : formatIndoDate(dateStr)
      } else if (isYesterday) {
        badgeLabel = 'Kemarin'
        const dayName = getIndoDayName(dateStr)
        title = dayName ? `${dayName}, ${formatIndoDate(dateStr)}` : formatIndoDate(dateStr)
      } else {
        const dayName = getIndoDayName(dateStr)
        badgeLabel = dayName || 'Riwayat'
        title = formatIndoDate(dateStr)
      }

      return {
        dateStr,
        isToday,
        isYesterday,
        badgeLabel,
        title,
        items
      }
    })
  }, [filteredInboundList, filterPreset, searchQuery])

  // Ringkasan Stok / Inventory
  const inventoryItems = useMemo(() => {
    const map = new Map()
    let list = supplierInboundList
    if (filterCategory !== 'ALL') {
      list = list.filter((it) => it.category?.toUpperCase() === filterCategory.toUpperCase())
    }
    for (const item of list) {
      const key = `${item.item_name}__${item.unit}`
      if (!map.has(key)) {
        map.set(key, {
          itemName: item.item_name,
          category: item.category,
          unit: item.unit,
          totalQty: 0,
          latestDate: item.inbound_date
        })
      }
      const entry = map.get(key)
      entry.totalQty += Number(item.quantity) || 0
      if (item.inbound_date && (!entry.latestDate || item.inbound_date > entry.latestDate)) {
        entry.latestDate = item.inbound_date
      }
    }
    let res = Array.from(map.values())
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      res = res.filter(
        (it) =>
          it.itemName?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q)
      )
    }
    return res
  }, [supplierInboundList, filterCategory, searchQuery])

  return (
    <div className="space-y-3 pb-24 font-sans select-none">
      {/* Toast Notifikasi Sukses */}
      {toastSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 bg-[#EAF5EE] border border-[#CBEAD6] rounded-xl text-[#2F7D5B] text-xs font-semibold animate-in fade-in"
        >
          <CheckIcon className="w-4 h-4 text-[#2F7D5B] shrink-0" />
          <span>{toastSuccess}</span>
        </div>
      )}

      {/* 1. Tombol Aksi */}
      <div className="flex items-center justify-end px-0.5 pt-0.5">
        <button
          type="button"
          onClick={openModal}
          className="min-h-[40px] h-10 px-3.5 rounded-xl border border-[#4685ac] bg-[#4685ac] hover:bg-[#3A6B80] active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
          title="Catat barang masuk baru"
          aria-label="Catat barang masuk"
        >
          <NotebookPen className="w-4 h-4 shrink-0" />
          <span>Catat Barang Masuk</span>
        </button>
      </div>

      {/* 2. Toolbar Pencarian Otomatis & Tombol Filter Dropdown (Overlay) */}
      <div className="flex items-center gap-2">
        {/* Kolom Pencarian Langsung */}
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#556575] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Nama barang.."
            className="w-full text-xs pl-8 pr-8 py-2.5 bg-white border border-[#EDE8DF] rounded-xl text-[#2C3E50] placeholder-[#556575] focus:outline-none focus:bg-white focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80] transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-7 h-7 absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#556575] hover:text-[#2C3E50] text-xs cursor-pointer rounded-lg hover:bg-[#EDE8DF]/60 transition"
              aria-label="Hapus teks pencarian"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tombol Filter dengan Badge Indikator Jumlah Filter Aktif (Persis Logs) */}
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

      {/* 3. Baris Chip Jalan Pintas (Persis seperti Riwayat / Logs: h-8, px-3, text-xs font-semibold, gap-1.5) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
        {[
          { id: 'ALL', label: 'Semua' },
          { id: 'INBOUND', label: 'Barang Masuk' },
          { id: 'OUTBOUND', label: 'Barang Keluar' },
          { id: 'INVENTORY', label: 'Inventory' }
        ].map((chip) => {
          const isActive = activeTab === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveTab(chip.id)}
              className={`h-8 px-3 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition active:scale-95 border ${isActive
                ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-xs'
                : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB] hover:text-[#2C3E50]'
                }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Tag Filter Aktif yang Dapat Dihapus Satuan (Persis Logs) */}
      {isFilterActive && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {filterCategory !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EDE8DF] text-[11px] text-[#2C3E50] font-medium">
              <span>Kategori: {INBOUND_CATEGORIES.find((c) => c.id === filterCategory)?.label || filterCategory}</span>
              <button
                type="button"
                onClick={() => handleFilterCategoryChange('ALL')}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                aria-label="Hapus filter kategori"
              >
                ✕
              </button>
            </span>
          )}

          {filterPreset !== 'recent' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EDE8DF] text-[11px] text-[#2C3E50] font-medium">
              <span>Waktu: {activePeriodLabel}</span>
              <button
                type="button"
                onClick={() => applyPreset('recent')}
                className="hover:text-rose-600 cursor-pointer ml-0.5"
                aria-label="Hapus filter waktu"
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

      {/* 4. Area Konten Riwayat Barang */}
      {/* Kasus 1: Tab SEMUA / BARANG MASUK */}
      {(activeTab === 'ALL' || activeTab === 'INBOUND') && (
        <>
          {isLoadingInbound ? (
            <div className="pt-2">
              <ListRowSkeleton count={4} />
            </div>
          ) : filteredInboundList.length === 0 ? (
            /* State Kosong Identik Riwayat / Logs */
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                {searchQuery
                  ? 'Tidak ada barang yang sesuai dengan kata kunci pencarian.'
                  : 'Belum ada riwayat barang.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#4685ac] text-white hover:bg-[#3A6B80] cursor-pointer transition shadow-2xs active:scale-95 mt-3"
                >
                  Reset pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#6B7B8D] font-medium">
                <span>{filteredInboundList.length} total transaksi</span>
                <span>Periode: {activePeriodLabel}</span>
              </div>

              {groupedInboundByDate.map((group) => {
                if (group.items.length === 0) {
                  return (
                    <div key={group.dateStr} className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EAF5EE] text-[#2F7D5B] border border-[#CBEAD6]">
                            {group.badgeLabel || 'Hari Ini'}
                          </span>
                          <span className="text-xs font-bold text-[#2C3E50]">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#6B7B8D] font-medium">
                          0 transaksi
                        </span>
                      </div>
                      <div className="bg-[#FAF7F2]/60 border border-dashed border-[#EDE8DF] rounded-xl p-3 text-center text-[11px] text-[#6B7B8D]">
                        Belum ada barang masuk tercatat hari ini.
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={group.dateStr} className="space-y-1.5">
                    {/* Section Divider per Hari */}
                    <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            group.isToday
                              ? 'bg-[#EAF5EE] text-[#2F7D5B] border-[#CBEAD6]'
                              : group.isYesterday
                              ? 'bg-[#F5F1EB] text-[#556575] border-[#EDE8DF]'
                              : 'bg-[#FAF7F2] text-[#6B7B8D] border-[#EDE8DF]'
                          }`}
                        >
                          {group.badgeLabel || 'Riwayat'}
                        </span>
                        <span className="text-xs font-bold text-[#2C3E50]">
                          {group.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6B7B8D] font-semibold">
                        {group.items.length} transaksi
                      </span>
                    </div>

                    {/* Kartu Transaksi per Hari */}
                    <div className="space-y-2">
                      {group.items.map((item, idx) => (
                        <div
                          key={item.inbound_id || idx}
                          className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs transition-all hover:border-[#D5CEBF]"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF7F2] text-[#4685ac] border border-[#EDE8DF]">
                                  {item.category}
                                </span>
                                <span className="font-bold text-xs text-[#2C3E50] block truncate">
                                  {item.item_name}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#6B7B8D] block">
                                {formatItemTime(item.created_at) ? `${formatItemTime(item.created_at)} • ` : ''}Supplier: <span className="font-semibold text-[#2C3E50]">{item.supplier_name}</span>
                                {item.document_no ? ` • SJ: ${item.document_no}` : ''}
                              </span>
                              {item.notes && (
                                <span className="text-[11px] text-[#6B7B8D] italic block">
                                  &ldquo;{item.notes}&rdquo;
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-xs text-[#2C3E50] tabular-nums block">
                                {item.quantity} <span className="text-[11px] font-semibold text-[#6B7B8D]">{formatUnitDisplay(item.unit)}</span>
                              </span>
                              <span className="text-[10px] text-[#6B7B8D] block mt-0.5">
                                {item.received_by || 'PPIC'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Kasus 2: Tab BARANG KELUAR */}
      {activeTab === 'OUTBOUND' && (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
          <p className="font-medium text-[#2C3E50]">
            Belum ada riwayat barang keluar.
          </p>
        </div>
      )}

      {/* Kasus 3: Tab INVENTORY */}
      {activeTab === 'INVENTORY' && (
        <>
          {inventoryItems.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                Belum ada data stok barang.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#6B7B8D] font-medium">
                <span>{inventoryItems.length} jenis barang terdata</span>
              </div>
              <div className="space-y-2">
                {inventoryItems.map((inv, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-2.5 hover:border-[#D5CEBF] transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF7F2] text-[#4685ac] border border-[#EDE8DF]">
                          {inv.category}
                        </span>
                        <span className="font-bold text-xs text-[#2C3E50] block truncate">
                          {inv.itemName}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                        Terakhir diterima: {formatIndoDate(inv.latestDate)}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-xs text-[#2C3E50] tabular-nums block">
                        {inv.totalQty} <span className="text-[11px] font-semibold text-[#6B7B8D]">{formatUnitDisplay(inv.unit)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL POP UP "CATAT BARANG MASUK" (Custom & Strict)  */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain select-none animate-in fade-in duration-150"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault()
          }}
        >
          {/* Backdrop (Klik di luar window untuk tutup jika tidak sedang submit) */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => !submitting && setIsModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 select-text overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between shrink-0 bg-[#F5F1EB]/80">
              <span className="text-xs font-bold text-[#2C3E50]">
                Catat Barang Masuk
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF] transition-colors cursor-pointer disabled:opacity-50"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form Scrollable Area (Hanya area ini yang dapat di-scroll) */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain space-y-3.5">
              {/* Banner Kesalahan Validasi Ketat */}
              {formError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 bg-[#FDEDEC] border border-[#FADBD8] rounded-xl text-[#9F2F2D] text-xs font-semibold animate-in fade-in"
                >
                  <AlertIcon className="w-4 h-4 text-[#E8352D] shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Kategori Barang (Custom Dropdown Sesuai Desain Sistem) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Kategori Barang
                </label>
                <CustomSelect
                  id="inbound-category"
                  ariaLabel="Kategori Barang"
                  value={category}
                  disabled={submitting}
                  onChange={handleCategoryChange}
                  options={INBOUND_CATEGORIES}
                  placeholder="Pilih Kategori Barang"
                />
              </div>

              {/* 2. Sub-Seleksi Dinamis (Hanya Muncul saat Pengaturan PPIC = Spesifik) */}
              {isDetailed && category === 'KULIT' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] animate-in fade-in">
                  <span className="text-xs font-bold text-[#2C3E50] block">
                    Ukuran Kulit
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSkinVariantSelect('9CM')}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${skinVariant === '9CM'
                        ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                        : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        }`}
                    >
                      Kulit 9cm (Mika)
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSkinVariantSelect('7CM')}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${skinVariant === '7CM'
                        ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                        : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        }`}
                    >
                      Kulit 7cm (Vakum)
                    </button>
                  </div>
                </div>
              )}

              {isDetailed && category === 'SAOS' && (
                <div className="space-y-1.5 p-3 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] animate-in fade-in">
                  <span className="text-xs font-bold text-[#2C3E50] block">
                    Varian Saos
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSauceVariantSelect('MIKA')}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${sauceVariant === 'MIKA'
                        ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                        : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        }`}
                    >
                      Saos Mika
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSauceVariantSelect('VAKUM')}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${sauceVariant === 'VAKUM'
                        ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                        : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        }`}
                    >
                      Saos Vakum
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Nama Barang */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Nama Barang
                </label>
                <input
                  type="text"
                  value={itemName}
                  disabled={submitting}
                  onChange={(e) => {
                    setItemName(e.target.value)
                    setFormError('')
                  }}
                  placeholder="Contoh: Kulit Dimsum 9 cm, Daging Paha Fillet, Plastik Vakum..."
                  className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs sm:text-sm font-semibold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60"
                  required
                />
              </div>

              {/* 4. Baris Jumlah & Dropdown Satuan (Lebar proporsional agar Satuan tidak terpotong) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  <span className="flex-1">Jumlah</span>
                  <span className="w-28 sm:w-32 shrink-0">Satuan</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Input Jumlah */}
                  <div className="flex-1 min-w-0 relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={quantity}
                      disabled={submitting}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="Contoh: 10"
                      className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-sm font-bold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60 tabular-nums"
                      required
                    />
                  </div>

                  {/* Dropdown Satuan */}
                  <div className="w-28 sm:w-32 shrink-0 relative">
                    <CustomSelect
                      id="inbound-unit"
                      ariaLabel="Satuan Barang"
                      value={unit}
                      disabled={submitting}
                      onChange={(val) => {
                        setUnit(val)
                        setFormError('')
                      }}
                      options={UNIT_OPTIONS}
                      placeholder="Satuan"
                      buttonClassName="px-3"
                      menuClassName="min-w-[140px] right-0 left-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Nama Supplier */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Nama Supplier
                </label>
                <input
                  type="text"
                  value={supplierName}
                  disabled={submitting}
                  onChange={(e) => {
                    setSupplierName(e.target.value)
                    setFormError('')
                  }}
                  placeholder="Contoh: CV Sumber Rejeki, Toko Jaya..."
                  className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs sm:text-sm font-semibold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60"
                  required
                />
              </div>

              {/* 6. No. Surat Jalan (Opsional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  No. Surat Jalan (Opsional)
                </label>
                <input
                  type="text"
                  value={documentNo}
                  disabled={submitting}
                  onChange={(e) => setDocumentNo(e.target.value)}
                  placeholder="Contoh: SJ-20261029-01"
                  className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs sm:text-sm font-semibold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60"
                />
              </div>

              {/* 7. Catatan Fisik (Opsional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Catatan Fisik (Opsional)
                </label>
                <textarea
                  value={notes}
                  disabled={submitting}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Kemasan utuh dan bersih, suhu beku terjaga..."
                  rows={2}
                  className="w-full p-3 bg-white border border-[#EDE8DF] rounded-xl text-xs sm:text-sm font-medium text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60 resize-none"
                />
              </div>

              {/* 8. Toggle Perlu Cetak QR atau Tidak */}
              <div className="p-3 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      needPrintQr ? 'bg-[#3A6B80] text-white shadow-2xs' : 'bg-white text-[#6B7B8D] border border-[#EDE8DF]'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#2C3E50] block leading-tight">
                      Cetak Label QR
                    </span>
                    <span className="text-[11px] text-[#556575] block truncate">
                      {needPrintQr ? 'Label QR akan langsung dibuka untuk dicetak' : 'Hanya simpan data tanpa cetak QR'}
                    </span>
                  </div>
                </div>

                {/* Switch Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={needPrintQr}
                  disabled={submitting}
                  onClick={() => setNeedPrintQr((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    needPrintQr ? 'bg-[#3A6B80]' : 'bg-[#D1D5DB]'
                  }`}
                  aria-label="Toggle perlu cetak QR"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      needPrintQr ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Tombol Simpan Barang Masuk */}
              <div className="pt-1">
                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={submitting}
                  isSuccess={isSubmitSuccess}
                  successText="Barang Masuk Tersimpan!"
                  className="font-bold text-xs sm:text-sm"
                >
                  {needPrintQr ? 'Simpan & Buka Cetak QR' : 'Simpan Barang Masuk'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bottom-Sheet / Dialog Filter Lanjutan (Persis seperti Riwayat / Logs) */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filter & urutkan riwayat"
        subtitle="Atur kriteria data barang yang ditampilkan"
        size="sm"
      >
        <div className="space-y-4">
          {/* Pilihan Kategori Barang */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2C3E50] block">
              Kategori barang
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'ALL', label: 'Semua Kategori' },
                ...INBOUND_CATEGORIES
              ].map((cat) => {
                const isSelected = filterCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleFilterCategoryChange(cat.id)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold transition text-left cursor-pointer border truncate ${
                      isSelected
                        ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                        : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pilihan Rentang Waktu */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2C3E50] block">
              Rentang waktu
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'recent', label: 'Hari Ini & Kemarin' },
                { id: 'today', label: 'Hari Ini' },
                { id: 'yesterday', label: 'Kemarin' },
                { id: 'single', label: 'Pilih Tanggal' },
                { id: 'range', label: 'Rentang Tanggal' },
                { id: 'all', label: 'Semua Waktu' }
              ].map((p) => {
                const isSelected = filterPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold transition text-left cursor-pointer border truncate ${
                      isSelected
                        ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                        : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Input Tanggal Tunggal */}
            {filterPreset === 'single' && (
              <div className="pt-2 space-y-1">
                <label className="text-[11px] font-semibold text-[#6B7B8D] block">
                  Pilih tanggal:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    const catParam = filterCategory === 'ALL' ? null : filterCategory
                    if (e.target.value) fetchSupplierInbound(e.target.value, catParam)
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] focus:outline-none focus:border-[#4685ac] shadow-2xs cursor-pointer"
                />
              </div>
            )}

            {/* Input Rentang Tanggal */}
            {filterPreset === 'range' && (
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#6B7B8D] block mb-1">
                      Dari
                    </label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] focus:outline-none focus:border-[#4685ac] shadow-2xs cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#6B7B8D] block mb-1">
                      Sampai
                    </label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] focus:outline-none focus:border-[#4685ac] shadow-2xs cursor-pointer"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (rangeStartDate && rangeEndDate) {
                      const catParam = filterCategory === 'ALL' ? null : filterCategory
                      fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
                    }
                  }}
                  className="w-full h-9 bg-[#4685ac] hover:bg-[#3A6B80] text-white text-xs font-bold rounded-xl cursor-pointer transition active:scale-95 shadow-2xs"
                >
                  Terapkan rentang tanggal
                </button>
              </div>
            )}
          </div>

          {/* Tombol Aksi Modal */}
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8DF] gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={handleResetFilter}
                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[#6B7B8D] hover:text-[#2C3E50] cursor-pointer transition rounded-xl"
              >
                Reset default
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="min-h-[44px] px-2.5 py-2 text-xs font-semibold text-[#4685ac] hover:text-[#3A6B80] hover:underline flex items-center gap-1 cursor-pointer transition rounded-xl"
                title="Ekspor data ke format Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
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
    </div>
  )
}

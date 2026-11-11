import { useState, useEffect, useCallback, useMemo } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { canExportExcel } from '../utils/permissions'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'
import { CustomSelect } from './ui/CustomSelect'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { ListRowSkeleton } from './ui/Skeleton'
import ExportReportBottomSheet from './ExportReportBottomSheet'
import {
  SearchIcon,
  FilterIcon,
  XIcon,
  AlertIcon
} from './Icons'
import {
  NotebookPen,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Download
} from 'lucide-react'
import {
  CardShell,
  TypeBadge,
  QtyBlock,
  FieldGrid,
  StatusChip
} from './ui/CardComponents'

const INBOUND_CATEGORIES = [
  { id: 'KULIT', label: 'Kulit Dimsum' },
  { id: 'DAGING', label: 'Daging Mentah' },
  { id: 'BUMBU', label: 'Bumbu & Minyak' },
  { id: 'SAOS', label: 'Saos Kemasan' },
  { id: 'KEMASAN', label: 'Kemasan & Plastik' },
  { id: 'LAINNYA', label: 'Lainnya' }
]

const DESTINATION_STATIONS = [
  { value: 'NONE', label: 'None (Tanpa Tujuan Khusus)' },
  { value: 'ASSEMBLY_STATION', label: 'Meja Cetak (Produksi 2)' },
  { value: 'MEAT_STATION', label: 'Giling & Mix (Produksi 1)' },
  { value: 'FINISHING_STATION', label: 'Meja Packing / Finishing' },
  { value: 'SPICE_STATION', label: 'Racik Bumbu' },
  { value: 'UMUM', label: 'Keluar Umum / Pemakaian Lain' }
]

function getInboundLotCode(item) {
  if (!item) return ''
  const dateStr = item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : getTodayStr())
  const todayCode = dateStr.replace(/-/g, '')
  const cat = (item.category || '').toUpperCase()
  const catPrefix = cat === 'KULIT' ? 'KL'
    : cat === 'DAGING' ? 'DG'
    : cat === 'BUMBU' ? 'BM'
    : cat === 'SAOS' ? 'SA'
    : cat === 'KEMASAN' ? 'KM'
    : 'SP'
  const rawId = item.inbound_id || 1
  const idStr = String(rawId).padStart(3, '0')
  return `IN-${catPrefix}-${todayCode}-${idStr}`
}

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
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false)
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false)
  const [isStockFormulaModalOpen, setIsStockFormulaModalOpen] = useState(false)
  useLockBodyScroll(isModalOpen || isStockOutModalOpen || isExportSheetOpen || isStockFormulaModalOpen)

  // Card Action Expansion States (User harus toggle kartu dulu baru tombol aksi muncul)
  const [expandedCardId, setExpandedCardId] = useState(null)

  // Form State Modal Keluarkan Stok (Barang Keluar)
  const [stockOutItem, setStockOutItem] = useState(null)
  const [stockOutQty, setStockOutQty] = useState('')
  const [stockOutStation, setStockOutStation] = useState('NONE')
  const [stockOutNotes, setStockOutNotes] = useState('')
  const [isSubmittingStockOut, setIsSubmittingStockOut] = useState(false)
  const [isStockOutSuccess, setIsStockOutSuccess] = useState(false)
  const [stockOutError, setStockOutError] = useState('')

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
  const [qrTipInboundId, setQrTipInboundId] = useState(null)

  // Store
  const planDetailMode = useProduction1Store((s) => s.planDetailMode) || 'GENERAL'
  const isDetailed = planDetailMode === 'DETAILED'

  const rawSupplierInboundList = useProduction1Store((s) => s.supplierInboundList)
  const supplierInboundList = rawSupplierInboundList || EMPTY_INBOUND_LIST
  const fetchSupplierInbound = useProduction1Store((s) => s.fetchSupplierInbound)
  const createSupplierInbound = useProduction1Store((s) => s.createSupplierInbound)

  const rawSupplierOutboundList = useProduction1Store((s) => s.supplierOutboundList)
  const supplierOutboundList = rawSupplierOutboundList || EMPTY_INBOUND_LIST
  const fetchSupplierOutbound = useProduction1Store((s) => s.fetchSupplierOutbound)
  const createSupplierOutbound = useProduction1Store((s) => s.createSupplierOutbound)

  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const canExport = canExportExcel(userRole, currentUser)

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

  const isFilterActive = filterCategory !== 'ALL' || filterPreset !== 'recent'
  const activeFilterCount = (filterCategory !== 'ALL' ? 1 : 0) + (filterPreset !== 'recent' ? 1 : 0)

  const loadAllData = useCallback(async () => {
    setIsLoadingInbound(true)
    try {
      const catParam = filterCategory === 'ALL' ? null : filterCategory
      if (filterPreset === 'recent') {
        await Promise.all([
          fetchSupplierInbound(getYesterdayStr(), catParam, getTodayStr()),
          fetchSupplierOutbound(getYesterdayStr(), catParam, getTodayStr())
        ])
      } else if (filterPreset === 'range') {
        await Promise.all([
          fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate),
          fetchSupplierOutbound(rangeStartDate, catParam, rangeEndDate)
        ])
      } else if (filterPreset === 'all') {
        await Promise.all([
          fetchSupplierInbound(null, catParam, null, true),
          fetchSupplierOutbound(null, catParam, null, true)
        ])
      } else {
        await Promise.all([
          fetchSupplierInbound(selectedDate, catParam),
          fetchSupplierOutbound(selectedDate, catParam)
        ])
      }
    } finally {
      setIsLoadingInbound(false)
    }
  }, [fetchSupplierInbound, fetchSupplierOutbound, filterPreset, filterCategory, rangeStartDate, rangeEndDate, selectedDate])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllData()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadAllData])

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
      fetchSupplierOutbound(y, catParam, t)
    } else if (preset === 'today') {
      const t = getTodayStr()
      setSelectedDate(t)
      fetchSupplierInbound(t, catParam)
      fetchSupplierOutbound(t, catParam)
    } else if (preset === 'yesterday') {
      const y = getYesterdayStr()
      setSelectedDate(y)
      fetchSupplierInbound(y, catParam)
      fetchSupplierOutbound(y, catParam)
    } else if (preset === 'single') {
      fetchSupplierInbound(selectedDate, catParam)
      fetchSupplierOutbound(selectedDate, catParam)
    } else if (preset === 'range') {
      fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
      fetchSupplierOutbound(rangeStartDate, catParam, rangeEndDate)
    } else if (preset === 'all') {
      fetchSupplierInbound(null, catParam, null, true)
      fetchSupplierOutbound(null, catParam, null, true)
    }
  }

  const handleFilterCategoryChange = (catId) => {
    setFilterCategory(catId)
    const catParam = catId === 'ALL' ? null : catId
    if (filterPreset === 'recent') {
      fetchSupplierInbound(getYesterdayStr(), catParam, getTodayStr())
      fetchSupplierOutbound(getYesterdayStr(), catParam, getTodayStr())
    } else if (filterPreset === 'range') {
      fetchSupplierInbound(rangeStartDate, catParam, rangeEndDate)
      fetchSupplierOutbound(rangeStartDate, catParam, rangeEndDate)
    } else if (filterPreset === 'all') {
      fetchSupplierInbound(null, catParam, null, true)
      fetchSupplierOutbound(null, catParam, null, true)
    } else {
      fetchSupplierInbound(selectedDate, catParam)
      fetchSupplierOutbound(selectedDate, catParam)
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
    fetchSupplierOutbound(y, null, t)
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
    setNeedPrintQr(true)
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
        received_by: operatorName || operatorId || 'PPIC-AYU',
        has_qr: needPrintQr
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

      // Tutup modal
      setIsModalOpen(false)
      setIsSubmitSuccess(false)

      // Muat ulang data
      loadAllData()

      // Buka modal cetak QR jika toggle aktif
      if (needPrintQr) {
        handleOpenPrintQrForInbound(created || {
          inbound_id: 1,
          category,
          item_name: cleanName,
          quantity: numQty,
          unit,
          supplier_name: cleanSupplier,
          created_at: ''
        })
      }
    } catch (err) {
      setFormError(err?.message || 'Gagal menyimpan barang masuk ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handler jika tombol Cetak QR ditekan pada barang tanpa QR
  const handleNoQrButtonClick = (item) => {
    if (!item) return
    setQrTipInboundId(item.inbound_id)
    useProduction1Store.setState({
      actionFeedback: {
        type: 'info',
        message: `💡 Tips: Barang "${item.item_name}" tidak memiliki label QR (dicatat tanpa QR).`
      }
    })
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40)
      }
    } catch {
      // ignore
    }
  }

  // Auto-dismiss tip popover setelah 3.5 detik
  useEffect(() => {
    if (!qrTipInboundId) return
    const timer = setTimeout(() => {
      setQrTipInboundId(null)
    }, 3500)
    return () => clearTimeout(timer)
  }, [qrTipInboundId])

  // Handler Cetak Ulang Label QR Barang Masuk
  const handleOpenPrintQrForInbound = (item) => {
    if (!item) return
    const baseCode = getInboundLotCode(item)
    const numQty = parseFloat(item.quantity) || 1
    const isIntQty = Number.isInteger(numQty) && numQty >= 1 && numQty <= 50
    const count = isIntQty ? Math.floor(numQty) : 1
    const printItems = []
    for (let i = 1; i <= count; i++) {
      const itemCode = count > 1 ? `${baseCode}-${String(i).padStart(2, '0')}` : baseCode
      printItems.push({
        lotCode: itemCode,
        title: `BARANG MASUK: ${(item.item_name || '').toUpperCase()}`,
        detail: `${item.supplier_name || 'Supplier'} · ${count > 1 ? `Unit ${i}/${count} (${formatUnitDisplay(item.unit)})` : `${numQty} ${formatUnitDisplay(item.unit)}`}`,
        weight: count > 1 ? `1 ${formatUnitDisplay(item.unit)}` : `${numQty} ${formatUnitDisplay(item.unit)}`,
        supplierName: item.supplier_name || 'Supplier',
        createdAt: item.created_at || new Date().toISOString()
      })
    }
    openBatchPrintModal(printItems, `BARANG MASUK: ${(item.item_name || '').toUpperCase()}`)
  }

  // Buka Modal Keluarkan Stok
  const handleOpenStockOutModal = (item) => {
    const alreadyOutbound = supplierOutboundList
      .filter((o) => o.inbound_id === item.inbound_id)
      .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
    const remaining = Math.max(0, (Number(item.quantity) || 0) - alreadyOutbound)

    if (remaining <= 0) {
      useProduction1Store.setState({
        actionFeedback: {
          type: 'error',
          message: `Stok "${item.item_name}" sudah habis (0 ${formatUnitDisplay(item.unit)}). Tidak dapat mengeluarkan stok.`
        }
      })
      return
    }

    setStockOutItem(item)
    setStockOutQty(String(remaining))

    // Default ketika dibuka adalah 'NONE' sesuai permintaan user
    setStockOutStation('NONE')

    setStockOutNotes('')
    setStockOutError('')
    setIsStockOutModalOpen(true)
  }

  // Submit Modal Keluarkan Stok
  const handleStockOutSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setStockOutError('')

    const numQty = parseFloat(stockOutQty)
    if (isNaN(numQty) || numQty <= 0) {
      setStockOutError('Jumlah yang dikeluarkan harus lebih dari 0.')
      return
    }

    // Validasi sisa stok aktual
    const alreadyOutbound = supplierOutboundList
      .filter((o) => o.inbound_id === stockOutItem?.inbound_id)
      .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
    const remaining = Math.max(0, (Number(stockOutItem?.quantity) || 0) - alreadyOutbound)

    if (remaining <= 0) {
      setStockOutError(`Stok barang "${stockOutItem?.item_name}" sudah habis (0 ${formatUnitDisplay(stockOutItem?.unit)}).`)
      return
    }

    if (numQty > remaining) {
      setStockOutError(`Jumlah keluar (${numQty} ${formatUnitDisplay(stockOutItem?.unit)}) melebihi sisa stok yang tersedia (${remaining} ${formatUnitDisplay(stockOutItem?.unit)}).`)
      return
    }

    const isSpecialStation = stockOutStation && stockOutStation !== 'NONE' && stockOutStation !== 'UMUM'
    const targetStation = isSpecialStation ? stockOutStation : null
    const stationMeta = DESTINATION_STATIONS.find((s) => s.value === stockOutStation || s.id === stockOutStation)
    const targetStationName = isSpecialStation && stationMeta ? stationMeta.label : null

    setIsSubmittingStockOut(true)
    try {
      await createSupplierOutbound({
        inbound_id: stockOutItem.inbound_id,
        category: stockOutItem.category,
        item_name: stockOutItem.item_name,
        quantity: numQty,
        unit: stockOutItem.unit,
        target_station: targetStation,
        target_station_name: targetStationName,
        notes: stockOutNotes.trim() || null,
        dispatched_by: operatorName || operatorId || 'PPIC-AYU'
      })

      setIsStockOutSuccess(true)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40)
        }
      } catch {
        // ignore
      }

      await new Promise((resolve) => setTimeout(resolve, 500))

      setIsStockOutModalOpen(false)
      setIsStockOutSuccess(false)

      loadAllData()
    } catch (err) {
      setStockOutError(err?.message || 'Gagal mencatat pengeluaran barang ke server.')
    } finally {
      setIsSubmittingStockOut(false)
    }
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

  // Filter daftar transaksi barang keluar
  const filteredOutboundList = useMemo(() => {
    let list = supplierOutboundList
    if (filterCategory !== 'ALL') {
      list = list.filter((it) => it.category?.toUpperCase() === filterCategory.toUpperCase())
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (it) =>
          it.item_name?.toLowerCase().includes(q) ||
          it.target_station_name?.toLowerCase().includes(q) ||
          it.lot_qr_code?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.dispatched_by?.toLowerCase().includes(q)
      )
    }
    return list
  }, [supplierOutboundList, filterCategory, searchQuery])

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

    if (filterPreset === 'recent' && !searchQuery.trim() && !map.has(today)) {
      map.set(today, [])
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))

    return sortedDates.map((dateStr) => {
      const items = map.get(dateStr) || []
      const isToday = dateStr === today
      const isYesterday = dateStr === yesterday

      let badgeLabel
      let title

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

  // Kelompokkan daftar transaksi barang keluar berdasarkan tanggal (divide beda hari)
  const groupedOutboundByDate = useMemo(() => {
    const today = getTodayStr()
    const yesterday = getYesterdayStr()

    const map = new Map()
    for (const item of filteredOutboundList) {
      const d = item.outbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : today)
      if (!map.has(d)) {
        map.set(d, [])
      }
      map.get(d).push(item)
    }

    if (filterPreset === 'recent' && !searchQuery.trim() && !map.has(today)) {
      map.set(today, [])
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))

    return sortedDates.map((dateStr) => {
      const items = map.get(dateStr) || []
      const isToday = dateStr === today
      const isYesterday = dateStr === yesterday

      let badgeLabel
      let title

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
  }, [filteredOutboundList, filterPreset, searchQuery])

  // Kelompokkan SELURUH transaksi (Masuk & Keluar) berdasarkan tanggal untuk tab "Semua"
  const groupedAllByDate = useMemo(() => {
    const today = getTodayStr()
    const yesterday = getYesterdayStr()

    const map = new Map()
    for (const item of filteredInboundList) {
      const d = item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : today)
      if (!map.has(d)) {
        map.set(d, [])
      }
      const rawTime = item.created_at || item.inbound_date
      const timeMs = rawTime ? new Date(String(rawTime).endsWith('Z') || String(rawTime).includes('+') ? rawTime : String(rawTime).replace(' ', 'T') + 'Z').getTime() : 0
      map.get(d).push({
        ...item,
        _type: 'INBOUND',
        _timeMs: isNaN(timeMs) ? 0 : timeMs
      })
    }

    for (const item of filteredOutboundList) {
      const d = item.outbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : today)
      if (!map.has(d)) {
        map.set(d, [])
      }
      const rawTime = item.created_at || item.outbound_date
      const timeMs = rawTime ? new Date(String(rawTime).endsWith('Z') || String(rawTime).includes('+') ? rawTime : String(rawTime).replace(' ', 'T') + 'Z').getTime() : 0
      map.get(d).push({
        ...item,
        _type: 'OUTBOUND',
        _timeMs: isNaN(timeMs) ? 0 : timeMs
      })
    }

    if (filterPreset === 'recent' && !searchQuery.trim() && !map.has(today)) {
      map.set(today, [])
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))

    return sortedDates.map((dateStr) => {
      const items = (map.get(dateStr) || []).sort((a, b) => (b._timeMs || 0) - (a._timeMs || 0))
      const isToday = dateStr === today
      const isYesterday = dateStr === yesterday

      let badgeLabel
      let title

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
  }, [filteredInboundList, filteredOutboundList, filterPreset, searchQuery])

  // Ringkasan Stok / Inventory (Stok Tersedia = Total Masuk - Total Keluar)
  const inventoryItems = useMemo(() => {
    const map = new Map()
    let inList = supplierInboundList
    let outList = supplierOutboundList
    if (filterCategory !== 'ALL') {
      inList = inList.filter((it) => it.category?.toUpperCase() === filterCategory.toUpperCase())
      outList = outList.filter((it) => it.category?.toUpperCase() === filterCategory.toUpperCase())
    }
    for (const item of inList) {
      const key = `${item.item_name}__${item.unit}`
      if (!map.has(key)) {
        map.set(key, {
          itemName: item.item_name,
          category: item.category,
          unit: item.unit,
          totalInbound: 0,
          totalOutbound: 0,
          stokTersedia: 0,
          latestDate: item.inbound_date
        })
      }
      const entry = map.get(key)
      entry.totalInbound += Number(item.quantity) || 0
      if (item.inbound_date && (!entry.latestDate || item.inbound_date > entry.latestDate)) {
        entry.latestDate = item.inbound_date
      }
    }
    for (const item of outList) {
      const key = `${item.item_name}__${item.unit}`
      if (!map.has(key)) {
        map.set(key, {
          itemName: item.item_name,
          category: item.category,
          unit: item.unit,
          totalInbound: 0,
          totalOutbound: 0,
          stokTersedia: 0,
          latestDate: item.outbound_date
        })
      }
      const entry = map.get(key)
      entry.totalOutbound += Number(item.quantity) || 0
      if (item.outbound_date && (!entry.latestDate || item.outbound_date > entry.latestDate)) {
        entry.latestDate = item.outbound_date
      }
    }
    for (const entry of map.values()) {
      entry.stokTersedia = Math.max(0, entry.totalInbound - entry.totalOutbound)
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

    // Urutan default: stok Habis (<= 0) di atas, lalu A-Z berdasarkan nama barang
    res.sort((a, b) => {
      const aHabis = a.stokTersedia <= 0 ? 0 : 1
      const bHabis = b.stokTersedia <= 0 ? 0 : 1
      if (aHabis !== bHabis) {
        return aHabis - bHabis
      }
      return (a.itemName || '').localeCompare(b.itemName || '', 'id')
    })

    return res
  }, [supplierInboundList, supplierOutboundList, filterCategory, searchQuery])

  // Waktu format WIB untuk header stok inventory
  const currentStockTimeStr = useMemo(() => {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace('.', ':')
  }, [])

  // Mengambil 5 pergerakan mutasi terakhir untuk satu item inventory
  const getRecentMutationsForItem = useCallback((itemName, unit) => {
    const mutations = []
    for (const item of supplierInboundList) {
      if (item.item_name === itemName && item.unit === unit) {
        const d = item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : '')
        mutations.push({
          type: 'MASUK',
          date: d,
          qty: item.quantity,
          detail: item.supplier_name ? `Dari ${item.supplier_name}` : 'Penerimaan',
          timeMs: item.created_at ? new Date(item.created_at).getTime() : 0
        })
      }
    }
    for (const item of supplierOutboundList) {
      if (item.item_name === itemName && item.unit === unit) {
        const d = item.outbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : '')
        const target = item.target_station_name || item.target_station || 'Keluar Umum'
        mutations.push({
          type: 'KELUAR',
          date: d,
          qty: item.quantity,
          detail: `Ke ${target}`,
          timeMs: item.created_at ? new Date(item.created_at).getTime() : 0
        })
      }
    }
    mutations.sort((a, b) => (b.timeMs || 0) - (a.timeMs || 0) || (b.date > a.date ? 1 : -1))
    return mutations.slice(0, 5)
  }, [supplierInboundList, supplierOutboundList])

  // Render Kartu Transaksi Barang Masuk (Inbound) - 3 Zona Berhierarki + Footer
  const renderInboundCard = (item, idx) => {
    const isExpanded = expandedCardId === item.inbound_id
    const itemOutbounds = supplierOutboundList.filter((o) => o.inbound_id === item.inbound_id)
    const alreadyOutbound = itemOutbounds.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
    const remainingStock = Math.max(0, (Number(item.quantity) || 0) - alreadyOutbound)
    const isOutOfStock = remainingStock <= 0
    const timeFormatted = formatItemTime(item.created_at)

    return (
      <div
        key={`in-${item.inbound_id || idx}`}
        className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-3.5 ${
          isExpanded ? 'border-[#4685ac] ring-1 ring-[#4685ac]/30 bg-[#FBFDFE]' : 'border-[#EDE8DF] hover:border-[#D5CEBF]'
        }`}
      >
        {/* ZONA A: Atas (Badge MASUK + Jam di kiri, Chevron tanpa kotak di kanan min 44px tap target) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#EAF5EE] text-[#2F7D5B] border border-[#CBEAD6]">
              MASUK
            </span>
            {timeFormatted && (
              <span className="text-xs font-medium text-[#6B7B8D]">
                {timeFormatted}
              </span>
            )}
            {(item.has_qr === false || item.has_qr === 0) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F5F1EB] text-[#8C9BA8] border border-[#EDE8DF]">
                Tanpa QR
              </span>
            )}
          </div>

          {/* Chevron tanpa kotak, min 44x44px tap area */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedCardId(isExpanded ? null : item.inbound_id)
            }}
            className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2.5 -my-2 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] active:scale-95 transition-colors cursor-pointer rounded-full"
            title={isExpanded ? 'Tutup aksi' : 'Tampilkan opsi aksi'}
            aria-label="Toggle opsi aksi"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#3A6B80]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#6B7B8D]" />
            )}
          </button>
        </div>

        {/* ZONA B: Tengah (Nama barang semibold maks 2 baris di kiri, Jumlah tebal & besar + unit kecil di kanan) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="font-semibold text-sm sm:text-base text-[#1E293B] line-clamp-2 leading-snug break-words">
              {item.item_name}
            </h3>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end">
              <span className="text-2xl sm:text-[26px] font-black text-[#1E293B] tabular-nums tracking-tight">
                {item.quantity}
              </span>
              <span className="text-xs font-bold text-[#6B7B8D] ml-1 uppercase">
                {formatUnitDisplay(item.unit)}
              </span>
            </div>
            {isOutOfStock ? (
              <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                Stok Habis
              </span>
            ) : alreadyOutbound > 0 ? (
              <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                Sisa: {remainingStock} {formatUnitDisplay(item.unit)}
              </span>
            ) : null}
          </div>
        </div>

        {/* ZONA C: Detail (Grid 2 Kolom, label abu-abu text-xs di atas, nilai text-sm di bawah) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-0.5">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs text-[#6B7B8D] font-medium block">Supplier</span>
            <p className="text-sm font-semibold text-[#1E293B] truncate" title={item.supplier_name}>
              {item.supplier_name || '-'}
            </p>
          </div>

          <div className="space-y-0.5 min-w-0">
            <span className="text-xs text-[#6B7B8D] font-medium block">No. SJ</span>
            <p className="text-sm font-semibold text-[#1E293B] truncate" title={item.document_no || '-'}>
              {item.document_no || '-'}
            </p>
          </div>

          <div className="space-y-0.5 min-w-0">
            <span className="text-xs text-[#6B7B8D] font-medium block">Penerima</span>
            <p className="text-sm font-semibold text-[#1E293B] truncate" title={item.received_by || 'PPIC'}>
              {item.received_by || 'PPIC'}
            </p>
          </div>

          {item.notes ? (
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs text-[#6B7B8D] font-medium block">Catatan</span>
              <p className="text-sm font-semibold text-[#1E293B] truncate" title={item.notes}>
                {item.notes}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs text-[#6B7B8D] font-medium block">Kategori</span>
              <p className="text-sm font-semibold text-[#1E293B] truncate">
                {INBOUND_CATEGORIES.find((c) => c.id === item.category)?.label || item.category || '-'}
              </p>
            </div>
          )}
        </div>

        {/* Panel Aksi Expandable (Muncul saat kartu ditoggle via chevron) */}
        {isExpanded && (
          <div className="pt-2.5 border-t border-dashed border-[#EDE8DF] flex items-center justify-end gap-2 animate-in fade-in duration-150 relative">
            {item.has_qr !== false && item.has_qr !== 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenPrintQrForInbound(item)
                }}
                className="min-h-[38px] px-3.5 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#FAF7F2] active:scale-95 text-[#2C3E50] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Buka QR"
              >
                <QrCode className="w-3.5 h-3.5 text-[#3A6B80]" />
                <span>Buka QR</span>
              </button>
            ) : (
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNoQrButtonClick(item)
                  }}
                  className="min-h-[38px] px-3.5 rounded-xl border border-[#EDE8DF] bg-[#F5F1EB] text-[#8C9BA8] hover:bg-[#EDE8DF] active:scale-95 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer opacity-70"
                  title="Tips: Barang ini tidak memiliki label QR"
                  aria-label="Buka QR (Dinonaktifkan: Barang tidak memiliki QR)"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#8C9BA8]" />
                  <span>Buka QR</span>
                </button>

                {qrTipInboundId === item.inbound_id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full right-0 mb-2 z-30 px-3 py-1.5 bg-[#1E2B37] text-white text-[11px] font-semibold rounded-xl shadow-xl flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 border border-neutral-700/50"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Barang tidak memiliki QR</span>
                    <div className="absolute top-full right-6 -mt-1 border-4 border-transparent border-t-[#1E2B37]" />
                  </div>
                )}
              </div>
            )}

            {isOutOfStock ? (
              <button
                type="button"
                disabled
                className="min-h-[38px] px-3.5 rounded-xl border border-stone-200 bg-stone-100 text-stone-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed opacity-75"
                title="Stok barang ini sudah habis (0)"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-stone-400" />
                <span>Stok Habis</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenStockOutModal(item)
                }}
                className="min-h-[38px] px-3.5 rounded-xl border border-red-600 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Keluarkan stok ke divisi produksi atau umum"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                <span>Keluarkan Stok</span>
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render Kartu Transaksi Barang Keluar (Outbound) - 3 Zona Berhierarki Reusable
  const renderOutboundCard = (item, idx) => {
    const cardKey = `out-${item.outbound_id || idx}`
    const isExpanded = expandedCardId === cardKey || expandedCardId === item.outbound_id
    const timeFormatted = formatItemTime(item.created_at)
    const targetStationName = item.target_station_name || item.target_station || 'Keluar Umum'

    return (
      <CardShell key={cardKey} isExpanded={isExpanded} variant="outbound">
        {/* ZONA A: Atas (Badge KELUAR + Jam di kiri, Chevron tanpa kotak di kanan min 44px tap target) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type="KELUAR" />
            {timeFormatted && (
              <span className="text-xs font-medium text-[#6B7B8D]">
                {timeFormatted}
              </span>
            )}
          </div>

          {/* Chevron tanpa kotak, min 44x44px tap area */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedCardId(isExpanded ? null : cardKey)
            }}
            className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2.5 -my-2 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] active:scale-95 transition-colors cursor-pointer rounded-full"
            title={isExpanded ? 'Tutup detail' : 'Tampilkan opsi detail'}
            aria-label="Toggle opsi detail barang keluar"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-rose-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#6B7B8D]" />
            )}
          </button>
        </div>

        {/* ZONA B: Tengah (Nama barang semibold maks 2 baris di kiri, Jumlah tebal & besar warna merah lembut di kanan) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="font-semibold text-sm sm:text-base text-[#1E293B] line-clamp-2 leading-snug break-words">
              {item.item_name}
            </h3>
          </div>

          <QtyBlock
            prefix="-"
            value={item.quantity}
            unit={formatUnitDisplay(item.unit)}
            colorClass="text-rose-600"
          />
        </div>

        {/* ZONA C: Detail (FieldGrid, label abu-abu text-xs di atas, nilai text-sm di bawah) */}
        <FieldGrid
          items={[
            {
              label: 'Tujuan Distribusi',
              value: (
                <span className="flex items-center gap-1.5 truncate">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[2.2]" />
                  <span className="truncate">{targetStationName}</span>
                </span>
              ),
              title: targetStationName
            },
            {
              label: 'Kategori',
              value: INBOUND_CATEGORIES.find((c) => c.id === item.category)?.label || item.category || '-'
            },
            {
              label: 'Petugas Pengeluar',
              value: item.dispatched_by || 'PPIC',
              fullWidth: true
            },
            ...(item.notes
              ? [
                  {
                    label: 'Catatan',
                    value: item.notes,
                    title: item.notes,
                    fullWidth: true
                  }
                ]
              : [])
          ]}
        />

        {/* Panel Aksi / Detail Expandable (Muncul saat kartu ditoggle via chevron) */}
        {isExpanded && item.lot_qr_code && (
          <div className="pt-2.5 border-t border-dashed border-[#EDE8DF] flex items-center justify-between gap-2 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <QrCode className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-mono text-xs text-[#2C3E50] font-semibold truncate">
                {item.lot_qr_code}
              </span>
            </div>
            <span className="text-[10px] text-[#8C9BA8] uppercase font-bold shrink-0">
              Kode QR Lot
            </span>
          </div>
        )}
      </CardShell>
    )
  }

  // Render Kartu Inventory - 3 Zona Berhierarki Reusable
  const renderInventoryCard = (inv, idx) => {
    const cardKey = `inv-${inv.itemName}__${inv.unit}`
    const isExpanded = expandedCardId === cardKey
    const isOutOfStock = inv.stokTersedia <= 0
    const recentMutations = isExpanded ? getRecentMutationsForItem(inv.itemName, inv.unit) : []
    const catLabel = INBOUND_CATEGORIES.find((c) => c.id === inv.category)?.label || inv.category || 'INVENTORY'

    return (
      <CardShell key={`inv-${idx}-${inv.itemName}`} isExpanded={isExpanded} variant="inventory">
        {/* ZONA A: Atas (Badge Kategori di kiri, StatusChip "Stok Habis" & Chevron di kanan) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type="CATEGORY" label={catLabel} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isOutOfStock && <StatusChip status="habis" label="Stok Habis" />}

            {/* Chevron tanpa kotak, min 44x44px tap area */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpandedCardId(isExpanded ? null : cardKey)
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2.5 -my-2 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] active:scale-95 transition-colors cursor-pointer rounded-full"
              title={isExpanded ? 'Tutup riwayat mutasi' : 'Lihat 5 mutasi terakhir'}
              aria-label="Toggle riwayat mutasi item"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[#3A6B80]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#6B7B8D]" />
              )}
            </button>
          </div>
        </div>

        {/* ZONA B: Tengah (Nama barang semibold maks 2 baris di kiri, Sisa Stok besar di kanan) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="font-semibold text-sm sm:text-base text-[#1E293B] line-clamp-2 leading-snug break-words">
              {inv.itemName}
            </h3>
          </div>

          <QtyBlock
            topLabel="Sisa Stok"
            value={inv.stokTersedia}
            unit={formatUnitDisplay(inv.unit)}
            colorClass={isOutOfStock ? 'text-rose-600' : 'text-[#1E293B]'}
          />
        </div>

        {/* ZONA C: Statistik 3 Kolom sama lebar dengan pemisah tipis (Masuk | Keluar | Terakhir bergerak) */}
        <div className="grid grid-cols-3 divide-x divide-[#EDE8DF] border-t border-[#EDE8DF] pt-3 text-center">
          <div className="px-1.5 space-y-0.5 text-left sm:text-center">
            <span className="text-[11px] text-[#6B7B8D] font-medium flex items-center justify-start sm:justify-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-emerald-600 shrink-0 stroke-[2.2]" />
              <span>Masuk</span>
            </span>
            <p className="text-sm font-bold text-[#1E293B] tabular-nums">
              +{inv.totalInbound}{' '}
              <span className="text-[10px] font-medium text-[#6B7B8D]">
                {formatUnitDisplay(inv.unit)}
              </span>
            </p>
          </div>

          <div className="px-1.5 space-y-0.5 text-left sm:text-center">
            <span className="text-[11px] text-[#6B7B8D] font-medium flex items-center justify-start sm:justify-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-rose-500 shrink-0 stroke-[2.2]" />
              <span>Keluar</span>
            </span>
            <p className="text-sm font-bold text-[#1E293B] tabular-nums">
              -{inv.totalOutbound}{' '}
              <span className="text-[10px] font-medium text-[#6B7B8D]">
                {formatUnitDisplay(inv.unit)}
              </span>
            </p>
          </div>

          <div className="px-1.5 space-y-0.5 text-left sm:text-center">
            <span className="text-[11px] text-[#6B7B8D] font-medium block">
              Terakhir Bergerak
            </span>
            <p className="text-xs sm:text-sm font-semibold text-[#1E293B] truncate">
              {inv.latestDate ? formatIndoDate(inv.latestDate) : '-'}
            </p>
          </div>
        </div>

        {/* Panel Riwayat 5 Pergerakan Terakhir (Expandable via Chevron) */}
        {isExpanded && (
          <div className="pt-3 border-t border-dashed border-[#EDE8DF] space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#6B7B8D]">
              <span>5 Pergerakan Terakhir:</span>
              <span>Kuantitas</span>
            </div>
            <div className="space-y-1.5">
              {recentMutations.length === 0 ? (
                <p className="text-xs text-[#8C9BA8] italic py-1">Belum ada riwayat pergerakan stok.</p>
              ) : (
                recentMutations.map((m, mIdx) => (
                  <div
                    key={mIdx}
                    className="flex items-center justify-between text-xs py-1 border-b border-[#F5F1EB] last:border-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          m.type === 'MASUK'
                            ? 'bg-[#EAF5EE] text-[#2F7D5B]'
                            : 'bg-[#FDEDEC] text-[#D9383A]'
                        }`}
                      >
                        {m.type}
                      </span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        {formatIndoDate(m.date)}
                      </span>
                      <span className="text-[#1E293B] font-medium truncate max-w-[120px] sm:max-w-[200px]">
                        {m.detail}
                      </span>
                    </div>
                    <span
                      className={`font-bold tabular-nums shrink-0 ml-2 ${
                        m.type === 'MASUK' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {m.type === 'MASUK' ? `+${m.qty}` : `-${m.qty}`} {formatUnitDisplay(inv.unit)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardShell>
    )
  }

  return (
    <div className="space-y-3 pb-24 font-sans select-none">
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

        {/* Tombol Ekspor Excel Cepat (PPIC / Supervisor) */}
        {canExport && (
          <button
            type="button"
            onClick={() => setIsExportSheetOpen(true)}
            className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold border border-[#3A6B80] bg-[#EEF5F9] text-[#3A6B80] hover:bg-[#D1E4EF] active:bg-[#C5DFEA] flex items-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0 shadow-2xs"
            title="Buka dialog ekspor laporan Excel"
            aria-label="Buka dialog ekspor laporan Excel"
          >
            <Download className="w-3.5 h-3.5 text-[#3A6B80] stroke-[2.2]" />
            <span>Ekspor</span>
          </button>
        )}
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

      {/* Kasus 1: Tab SEMUA (Tampilkan Masuk & Keluar secara kronologis) */}
      {activeTab === 'ALL' && (
        <>
          {isLoadingInbound ? (
            <div className="pt-2">
              <ListRowSkeleton count={4} />
            </div>
          ) : filteredInboundList.length === 0 && filteredOutboundList.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                {searchQuery
                  ? 'Tidak ada barang yang sesuai dengan kata kunci pencarian.'
                  : 'Belum ada riwayat transaksi barang.'}
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
            <div className="space-y-3 pt-0.5">
              {groupedAllByDate.map((group) => {
                if (group.items.length === 0) {
                  return (
                    <div key={group.dateStr} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#2C3E50]">
                            {group.badgeLabel || 'Hari Ini'}
                          </span>
                          <span className="text-xs text-[#6B7B8D]">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2 py-0.5 rounded-full">
                          0 Transaksi
                        </span>
                      </div>
                      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 text-center text-xs text-[#556575] font-medium shadow-2xs">
                        Belum ada barang masuk atau keluar tercatat hari ini.
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={group.dateStr} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#2C3E50]">
                          {group.badgeLabel || 'Riwayat'}
                        </span>
                        <span className="text-xs text-[#6B7B8D]">
                          {group.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-0.5 rounded-full">
                        {group.items.length} Transaksi
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {group.items.map((item, idx) =>
                        item._type === 'OUTBOUND'
                          ? renderOutboundCard(item, idx)
                          : renderInboundCard(item, idx)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Kasus 2: Tab BARANG MASUK */}
      {activeTab === 'INBOUND' && (
        <>
          {isLoadingInbound ? (
            <div className="pt-2">
              <ListRowSkeleton count={4} />
            </div>
          ) : filteredInboundList.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                {searchQuery
                  ? 'Tidak ada barang masuk yang sesuai dengan kata kunci pencarian.'
                  : 'Belum ada riwayat barang masuk.'}
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
            <div className="space-y-3 pt-0.5">
              {groupedInboundByDate.map((group) => {
                if (group.items.length === 0) {
                  return (
                    <div key={group.dateStr} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#2C3E50]">
                            {group.badgeLabel || 'Hari Ini'}
                          </span>
                          <span className="text-xs text-[#6B7B8D]">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2 py-0.5 rounded-full">
                          0 Transaksi
                        </span>
                      </div>
                      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 text-center text-xs text-[#556575] font-medium shadow-2xs">
                        Belum ada barang masuk tercatat hari ini.
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={group.dateStr} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#2C3E50]">
                          {group.badgeLabel || 'Riwayat'}
                        </span>
                        <span className="text-xs text-[#6B7B8D]">
                          {group.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-0.5 rounded-full">
                        {group.items.length} Transaksi
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {group.items.map((item, idx) => renderInboundCard(item, idx, false))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Kasus 3: Tab BARANG KELUAR */}
      {activeTab === 'OUTBOUND' && (
        <>
          {isLoadingInbound ? (
            <div className="pt-2">
              <ListRowSkeleton count={4} />
            </div>
          ) : filteredOutboundList.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                {searchQuery
                  ? 'Tidak ada barang keluar yang sesuai dengan kata kunci pencarian.'
                  : 'Belum ada barang keluar di periode ini'}
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
            <div className="space-y-3 pt-0.5">
              {groupedOutboundByDate.map((group) => {
                if (group.items.length === 0) {
                  return (
                    <div key={group.dateStr} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#2C3E50]">
                            {group.badgeLabel || 'Hari Ini'}
                          </span>
                          <span className="text-xs text-[#6B7B8D]">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-0.5 rounded-full">
                          0 Transaksi
                        </span>
                      </div>
                      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 text-center text-xs text-[#556575] font-medium shadow-2xs">
                        Belum ada barang keluar di periode ini
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={group.dateStr} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#2C3E50]">
                          {group.badgeLabel || 'Riwayat'}
                        </span>
                        <span className="text-xs text-[#6B7B8D]">
                          {group.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#6B7B8D] bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-0.5 rounded-full">
                        {group.items.length} Transaksi
                      </span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {group.items.map((item, idx) => renderOutboundCard(item, idx))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Kasus 4: Tab INVENTORY */}
      {activeTab === 'INVENTORY' && (
        <>
          {inventoryItems.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-xs text-[#6B7B8D] shadow-2xs mt-2">
              <p className="font-medium text-[#2C3E50]">
                {searchQuery
                  ? 'Tidak ada data inventory yang sesuai dengan pencarian.'
                  : 'Belum ada data inventory'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-0.5">
              <div className="flex items-center justify-between px-1 text-[11px] text-[#6B7B8D] font-medium pb-1">
                <span className="font-bold text-[#2C3E50]">
                  {inventoryItems.length} jenis barang
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Stok per {formatIndoDate(getTodayStr())}, {currentStockTimeStr} WIB</span>
                  <button
                    type="button"
                    onClick={() => setIsStockFormulaModalOpen(true)}
                    className="w-5 h-5 rounded-full hover:bg-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] inline-flex items-center justify-center transition cursor-pointer"
                    title="Informasi Perhitungan Sisa Stok"
                    aria-label="Informasi Perhitungan Sisa Stok"
                  >
                    <Info className="w-3.5 h-3.5 text-[#3A6B80]" />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {inventoryItems.map((inv, idx) => renderInventoryCard(inv, idx))}
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
                      Buka QR
                    </span>
                    <span className="text-[11px] text-[#556575] block truncate">
                      {needPrintQr ? 'Label QR akan langsung dibuka setelah disimpan' : 'Hanya simpan data tanpa buka QR'}
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

      {/* ======================================================== */}
      {/* 6. MODAL POP UP "KELUARKAN STOK (BARANG KELUAR)"        */}
      {/* ======================================================== */}
      {isStockOutModalOpen && stockOutItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain select-none animate-in fade-in duration-150"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault()
          }}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => !isSubmittingStockOut && setIsStockOutModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 select-text overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between shrink-0 bg-[#F5F1EB]/80">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-[#4685ac]" />
                <span className="text-xs font-bold text-[#2C3E50]">
                  Keluarkan Stok (Barang Keluar)
                </span>
              </div>
              <button
                type="button"
                disabled={isSubmittingStockOut}
                onClick={() => setIsStockOutModalOpen(false)}
                className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF] transition-colors cursor-pointer disabled:opacity-50"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form Scrollable Area */}
            <form onSubmit={handleStockOutSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain space-y-3.5">
              {/* Ringkasan Barang yang Dikeluarkan */}
              <div className="p-3 bg-[#FAF7F2] border border-[#EDE8DF] rounded-xl space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-[#4685ac] border border-[#EDE8DF]">
                    {stockOutItem.category}
                  </span>
                  <span className="text-[11px] text-[#6B7B8D]">
                    Supplier: <strong className="text-[#2C3E50]">{stockOutItem.supplier_name}</strong>
                  </span>
                </div>
                <div className="text-xs font-bold text-[#2C3E50]">
                  {stockOutItem.item_name}
                </div>
                <div className="text-[11px] text-[#6B7B8D]">
                  Stok: <strong className="text-[#2C3E50] font-semibold">{(() => {
                    const already = supplierOutboundList
                      .filter((o) => o.inbound_id === stockOutItem.inbound_id)
                      .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
                    return Math.max(0, (Number(stockOutItem.quantity) || 0) - already)
                  })()} {formatUnitDisplay(stockOutItem.unit)}</strong>
                </div>
              </div>

              {/* Banner Kesalahan */}
              {stockOutError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 bg-[#FDEDEC] border border-[#FADBD8] rounded-xl text-[#9F2F2D] text-xs font-semibold animate-in fade-in"
                >
                  <AlertIcon className="w-4 h-4 text-[#E8352D] shrink-0" />
                  <span>{stockOutError}</span>
                </div>
              )}

              {/* Input Jumlah Dikeluarkan */}
              {(() => {
                const already = supplierOutboundList
                  .filter((o) => o.inbound_id === stockOutItem.inbound_id)
                  .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
                const currentRemaining = Math.max(0, (Number(stockOutItem.quantity) || 0) - already)

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                        Jumlah Dikeluarkan ({formatUnitDisplay(stockOutItem.unit)})
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Sisa: <strong>{currentRemaining} {formatUnitDisplay(stockOutItem.unit)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stockOutQty}
                        disabled={isSubmittingStockOut}
                        onChange={(e) => {
                          setStockOutError('')
                          setStockOutQty(e.target.value.replace(/[^0-9.]/g, ''))
                        }}
                        placeholder={`Maks ${currentRemaining}`}
                        className="flex-1 h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-sm font-bold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs tabular-nums"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setStockOutQty(String(currentRemaining))}
                        className="px-2.5 h-11 bg-[#FAF7F2] hover:bg-[#EDE8DF] border border-[#EDE8DF] rounded-xl text-xs font-bold text-[#4685ac] cursor-pointer transition active:scale-95"
                        title="Isi jumlah maksimal sisa stok"
                      >
                        Maks
                      </button>
                      <span className="px-3 h-11 flex items-center bg-[#FAF7F2] border border-[#EDE8DF] rounded-xl text-xs font-bold text-[#6B7B8D]">
                        {formatUnitDisplay(stockOutItem.unit)}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Pilihan Tujuan Pengiriman (Opsional Dropdown) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Tujuan Pengiriman (Opsional)
                </label>
                <CustomSelect
                  id="stockout-target-station"
                  ariaLabel="Tujuan Pengiriman"
                  value={stockOutStation}
                  disabled={isSubmittingStockOut}
                  onChange={(val) => setStockOutStation(val)}
                  options={DESTINATION_STATIONS}
                  placeholder="Pilih Tujuan Pengiriman (Opsional)"
                />
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Catatan Pengeluaran (Opsional)
                </label>
                <input
                  type="text"
                  value={stockOutNotes}
                  disabled={isSubmittingStockOut}
                  onChange={(e) => setStockOutNotes(e.target.value)}
                  placeholder="Contoh: Kebutuhan cetak kloter pagi, shift 1..."
                  className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs sm:text-sm font-semibold text-[#2C3E50] placeholder-[#6B7B8D] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs disabled:opacity-60"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={isSubmittingStockOut}
                  isSuccess={isStockOutSuccess}
                  successText="Pengeluaran Berhasil Dicatat!"
                  className="font-bold text-xs sm:text-sm"
                >
                  Konfirmasi Pengeluaran Stok
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

      {/* 5. Bottom Sheet Ekspor Laporan PPIC (Barang Masuk, Keluar, Inventory, Mutasi) */}
      <ExportReportBottomSheet
        isOpen={isExportSheetOpen}
        onClose={() => setIsExportSheetOpen(false)}
        activeTab={activeTab}
        initialCategory={filterCategory}
        operatorName={operatorName || 'Ayu (PPIC)'}
        fallbackInboundList={supplierInboundList}
        fallbackOutboundList={supplierOutboundList}
      />

      {/* 6. Modal Informasi Rumus Perhitungan Sisa Stok */}
      {isStockFormulaModalOpen && (
        <Modal
          isOpen={isStockFormulaModalOpen}
          onClose={() => setIsStockFormulaModalOpen(false)}
          title="Formula Perhitungan Sisa Stok"
        >
          <div className="p-4 sm:p-5 space-y-3.5 text-xs text-[#2C3E50]">
            <div className="p-3.5 bg-[#FAF7F2] border border-[#EDE8DF] rounded-xl font-mono text-center font-bold text-[#3A6B80] text-sm">
              Sisa Stok = Total Masuk − Total Keluar
            </div>
            <p className="text-[#6B7B8D] leading-relaxed">
              Nilai sisa stok dihitung secara otomatis dan real-time dari akumulasi seluruh pencatatan transaksi barang masuk dari supplier luar dikurangi pengeluaran barang ke stasiun produksi dan pemakaian operasional lainnya.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStockFormulaModalOpen(false)}
                className="min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold bg-[#3A6B80] text-white hover:bg-[#2C3E50] cursor-pointer shadow-xs transition active:scale-95"
              >
                Mengerti
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

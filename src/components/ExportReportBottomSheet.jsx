import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  FileSpreadsheet,
  Download,
  X,
  Calendar,
  Filter,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Layers
} from 'lucide-react'
import { apiGet } from '../utils/api'
import { exportPpicCustomExcel } from '../utils/excelExport'

const INBOUND_CATEGORIES = [
  { id: 'ALL', label: 'Semua Kategori' },
  { id: 'KULIT', label: 'Kulit Dimsum' },
  { id: 'DAGING', label: 'Daging Mentah' },
  { id: 'BUMBU', label: 'Bumbu & Minyak' },
  { id: 'SAOS', label: 'Saos Kemasan' },
  { id: 'KEMASAN', label: 'Kemasan & Plastik' },
  { id: 'LAINNYA', label: 'Lainnya' }
]

const getTodayStr = () => {
  const d = new Date()
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

const getYesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

const getLast7DaysStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

const getThisMonthRange = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return { start: `${year}-${month}-01`, end: getTodayStr() }
}

const getLastMonthRange = () => {
  const now = new Date()
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthIdx = now.getMonth() === 0 ? 12 : now.getMonth()
  const month = String(monthIdx).padStart(2, '0')
  const lastDay = new Date(year, monthIdx, 0).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  }
}

const formatIndoDate = (dStr) => {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return dStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const day = parseInt(parts[2], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${months[monthIdx] || parts[1]} ${year}`
}

const formatRangeConcise = (startStr, endStr) => {
  if (!startStr || !endStr) return ''
  if (startStr === endStr) return formatIndoDate(startStr)
  const sParts = startStr.split('-')
  const eParts = endStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const sDay = parseInt(sParts[2], 10)
  const eDay = parseInt(eParts[2], 10)
  const sMonth = months[parseInt(sParts[1], 10) - 1]
  const eMonth = months[parseInt(eParts[1], 10) - 1]
  const sYear = sParts[0]
  const eYear = eParts[0]

  if (sYear === eYear && sMonth === eMonth) {
    return `${sDay} - ${eDay} ${eMonth} ${eYear}`
  }
  if (sYear === eYear) {
    return `${sDay} ${sMonth} - ${eDay} ${eMonth} ${eYear}`
  }
  return `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`
}

export default function ExportReportBottomSheet({
  isOpen,
  onClose,
  activeTab = 'INBOUND',
  initialCategory = 'ALL',
  operatorName = 'Ayu (PPIC)',
  fallbackInboundList = [],
  fallbackOutboundList = []
}) {
  // 1. Jenis Laporan State (Default mengikuti tab yang aktif di layar)
  const [reportType, setReportType] = useState('INBOUND')

  // 2. Periode Preset State
  const [periodPreset, setPeriodPreset] = useState('today') // 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'single' | 'range' | 'now'
  const [selectedSingleDate, setSelectedSingleDate] = useState(getTodayStr())
  const [dateFrom, setDateFrom] = useState(getTodayStr())
  const [dateTo, setDateTo] = useState(getTodayStr())

  // 3. Filter Opsional State (Collapsed by default)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [supplierFilter, setSupplierFilter] = useState('')

  // 4. Loading & Action States
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Sinkronisasi inisialisasi saat sheet dibuka
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      const initialType =
        activeTab === 'OUTBOUND'
          ? 'OUTBOUND'
          : activeTab === 'INVENTORY'
          ? 'INVENTORY'
          : activeTab === 'ALL'
          ? 'ALL'
          : 'INBOUND'
      setReportType(initialType)

      if (initialType === 'INVENTORY') {
        setPeriodPreset('now')
      } else {
        setPeriodPreset('today')
      }

      const today = getTodayStr()
      setSelectedSingleDate(today)
      setDateFrom(today)
      setDateTo(today)
      setCategoryFilter(initialCategory || 'ALL')
      setSupplierFilter('')
      setErrorMessage('')
      setDownloadSuccess(false)
      setIsFilterExpanded(Boolean(initialCategory && initialCategory !== 'ALL'))
    }, 0)
    return () => clearTimeout(timer)
  }, [isOpen, activeTab, initialCategory])

  // Hitung Tanggal Efektif (date_from & date_to) berdasarkan preset
  const { effectiveFrom, effectiveTo, effectiveLabel } = useMemo(() => {
    const today = getTodayStr()
    const yesterday = getYesterdayStr()

    if (reportType === 'INVENTORY') {
      if (periodPreset === 'now') {
        return {
          effectiveFrom: today,
          effectiveTo: today,
          effectiveLabel: 'Stok Saat Ini (Real-time)'
        }
      }
      if (periodPreset === 'single') {
        return {
          effectiveFrom: selectedSingleDate,
          effectiveTo: selectedSingleDate,
          effectiveLabel: `Stok per ${formatIndoDate(selectedSingleDate)}`
        }
      }
      // range
      const validTo = dateTo >= dateFrom ? dateTo : dateFrom
      return {
        effectiveFrom: dateFrom,
        effectiveTo: validTo,
        effectiveLabel: `Mutasi & Stok: ${formatRangeConcise(dateFrom, validTo)}`
      }
    }

    if (periodPreset === 'today') {
      return {
        effectiveFrom: today,
        effectiveTo: today,
        effectiveLabel: `Hari Ini (${formatIndoDate(today)})`
      }
    }
    if (periodPreset === 'yesterday') {
      return {
        effectiveFrom: yesterday,
        effectiveTo: yesterday,
        effectiveLabel: `Kemarin (${formatIndoDate(yesterday)})`
      }
    }
    if (periodPreset === 'last7') {
      const from7 = getLast7DaysStr()
      return {
        effectiveFrom: from7,
        effectiveTo: today,
        effectiveLabel: `7 Hari Terakhir (${formatRangeConcise(from7, today)})`
      }
    }
    if (periodPreset === 'thisMonth') {
      const { start, end } = getThisMonthRange()
      return {
        effectiveFrom: start,
        effectiveTo: end,
        effectiveLabel: `Bulan Ini (${formatRangeConcise(start, end)})`
      }
    }
    if (periodPreset === 'lastMonth') {
      const { start, end } = getLastMonthRange()
      return {
        effectiveFrom: start,
        effectiveTo: end,
        effectiveLabel: `Bulan Lalu (${formatRangeConcise(start, end)})`
      }
    }
    if (periodPreset === 'single') {
      return {
        effectiveFrom: selectedSingleDate,
        effectiveTo: selectedSingleDate,
        effectiveLabel: formatIndoDate(selectedSingleDate)
      }
    }
    // range
    const validTo = dateTo >= dateFrom ? dateTo : dateFrom
    return {
      effectiveFrom: dateFrom,
      effectiveTo: validTo,
      effectiveLabel: formatRangeConcise(dateFrom, validTo)
    }
  }, [reportType, periodPreset, selectedSingleDate, dateFrom, dateTo])

  // Fetch Live Summary Preview dari Backend
  const loadPreviewSummary = useCallback(async () => {
    if (!isOpen) return
    setIsLoadingPreview(true)
    setErrorMessage('')

    try {
      const params = new URLSearchParams({
        jenis_laporan: reportType,
        date_from: effectiveFrom,
        date_to: effectiveTo
      })
      if (categoryFilter && categoryFilter !== 'ALL') {
        params.append('category', categoryFilter)
      }
      if (supplierFilter.trim()) {
        params.append('supplier', supplierFilter.trim())
      }

      const res = await apiGet(`/production1/ppic/export-report?${params.toString()}`)
      setPreviewData(res)
    } catch {
      // Fallback lokal jika jaringan offline / server error
      const catMatch = (item) =>
        categoryFilter === 'ALL' || (item.category || '').toUpperCase() === categoryFilter.toUpperCase()
      const supMatch = (item) =>
        !supplierFilter.trim() ||
        (item.supplier_name || '').toLowerCase().includes(supplierFilter.trim().toLowerCase())

      let count = 0
      if (reportType === 'INBOUND' || reportType === 'ALL') {
        count += fallbackInboundList.filter(catMatch).filter(supMatch).length
      }
      if (reportType === 'OUTBOUND' || reportType === 'ALL') {
        count += fallbackOutboundList.filter(catMatch).length
      }
      if (reportType === 'INVENTORY') {
        count = Math.max(1, fallbackInboundList.length)
      }

      setPreviewData({
        status: 'fallback',
        total_records: count,
        inbound_items: fallbackInboundList.filter(catMatch).filter(supMatch),
        outbound_items: fallbackOutboundList.filter(catMatch),
        inventory_items: []
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }, [
    isOpen,
    reportType,
    effectiveFrom,
    effectiveTo,
    categoryFilter,
    supplierFilter,
    fallbackInboundList,
    fallbackOutboundList
  ])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPreviewSummary()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadPreviewSummary])

  // Validasi Rentang Tanggal
  const isDateRangeInvalid = periodPreset === 'range' && dateTo < dateFrom
  const totalRecordCount = previewData?.total_records || 0
  const isExportDisabled = isDownloading || isDateRangeInvalid || (totalRecordCount === 0 && !isLoadingPreview)

  // Handler Download Excel
  const handleDownloadExcel = async () => {
    if (isExportDisabled) return
    setIsDownloading(true)
    setErrorMessage('')

    try {
      // 1. Ambil data payload terbaru dari backend
      const params = new URLSearchParams({
        jenis_laporan: reportType,
        date_from: effectiveFrom,
        date_to: effectiveTo
      })
      if (categoryFilter && categoryFilter !== 'ALL') {
        params.append('category', categoryFilter)
      }
      if (supplierFilter.trim()) {
        params.append('supplier', supplierFilter.trim())
      }

      let payload = previewData
      try {
        payload = await apiGet(`/production1/ppic/export-report?${params.toString()}`)
      } catch (e) {
        // Jika fetch gagal saat klik, pakai previewData yang sudah ada
        if (!payload || !payload.total_records) {
          throw new Error(e?.message || 'Gagal memuat data dari server.', { cause: e })
        }
      }

      // 2. Ekspor ke format multi-sheet Excel XML
      exportPpicCustomExcel({
        reportType,
        dateFrom: effectiveFrom,
        dateTo: effectiveTo,
        categoryFilter,
        supplierFilter: supplierFilter.trim(),
        inboundItems: payload.inbound_items || [],
        outboundItems: payload.outbound_items || [],
        inventoryItems: payload.inventory_items || [],
        summary: payload.summary || {},
        operatorName
      })

      // 3. Konfirmasi Sukses & Getar Haptik
      setDownloadSuccess(true)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50)
        }
      } catch {
        // ignore
      }

      // Tutup otomatis setelah 1.5 detik
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat mengekspor file Excel.')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop Gelap Halus */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs"
        />

        {/* Bottom Sheet Modal Container */}
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#EDE8DF] flex flex-col max-h-[92dvh] z-10 overflow-hidden font-sans"
        >
          {/* Header Sheet dengan Grabber Bar & Close Button */}
          <div className="px-5 pt-3 pb-3 border-b border-[#EDE8DF] shrink-0 bg-[#FAF7F2]">
            <div className="w-12 h-1 bg-[#D5CEBF] rounded-full mx-auto mb-2.5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EEF5F9] border border-[#C5DFEA] flex items-center justify-center text-[#3A6B80]">
                  <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#1E293B] tracking-tight">
                    Ekspor Laporan Excel
                  </h2>
                  <span className="text-[11px] text-[#6B7B8D] block">
                    Format resmi PPIC (Rincian & Ringkasan)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[#6B7B8D] hover:text-[#1E293B] hover:bg-[#EDE8DF] cursor-pointer transition active:scale-95"
                title="Tutup"
                aria-label="Tutup ekspor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Konten Scrollable */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs overscroll-contain">
            {/* SEKSI 1: Jenis Laporan */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider block">
                1. Jenis Laporan
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'INBOUND', label: 'Barang Masuk', icon: ArrowDownLeft, desc: 'Penerimaan supplier' },
                  { id: 'OUTBOUND', label: 'Barang Keluar', icon: ArrowUpRight, desc: 'Distribusi stasiun' },
                  { id: 'INVENTORY', label: 'Inventory (Stok)', icon: Package, desc: 'Sisa & rekonsiliasi' },
                  { id: 'ALL', label: 'Semua Mutasi', icon: Layers, desc: 'Masuk + Keluar' }
                ].map((item) => {
                  const Icon = item.icon
                  const isActive = reportType === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setReportType(item.id)
                        if (item.id === 'INVENTORY') {
                          setPeriodPreset('now')
                        } else if (periodPreset === 'now') {
                          setPeriodPreset('today')
                        }
                      }}
                      className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all active:scale-95 flex items-start gap-2 ${
                        isActive
                          ? 'border-[#3A6B80] bg-[#EEF5F9] text-[#1E293B] shadow-xs ring-1 ring-[#3A6B80]/30'
                          : 'border-[#EDE8DF] bg-white text-[#6B7B8D] hover:bg-[#FAF7F2] hover:text-[#1E293B]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-[#3A6B80]' : 'text-[#8C9BA8]'}`} />
                      <div className="min-w-0">
                        <span className={`block font-bold text-xs ${isActive ? 'text-[#3A6B80]' : 'text-[#1E293B]'}`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-[#8C9BA8] block truncate">{item.desc}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* SEKSI 2: Periode Transaksi (Chips Presets) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider block">
                2. Periode Laporan
              </label>

              {reportType === 'INVENTORY' ? (
                // Preset Khusus Inventory
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'now', label: 'Stok Sekarang (Live)' },
                    { id: 'single', label: 'Snapshot Per Tanggal' },
                    { id: 'range', label: 'Rekap Periode Mutasi' }
                  ].map((chip) => {
                    const isActive = periodPreset === chip.id
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setPeriodPreset(chip.id)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition active:scale-95 ${
                          isActive
                            ? 'bg-[#3A6B80] text-white border-[#3A6B80] shadow-xs'
                            : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#FAF7F2] hover:text-[#1E293B]'
                        }`}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                // Preset Transaksi Barang Masuk / Keluar / Mutasi
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'today', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: 'last7', label: '7 Hari' },
                    { id: 'thisMonth', label: 'Bulan Ini' },
                    { id: 'lastMonth', label: 'Bulan Lalu' },
                    { id: 'single', label: 'Pilih Tanggal' },
                    { id: 'range', label: 'Rentang Tanggal' }
                  ].map((chip) => {
                    const isActive = periodPreset === chip.id
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setPeriodPreset(chip.id)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition active:scale-95 ${
                          isActive
                            ? 'bg-[#3A6B80] text-white border-[#3A6B80] shadow-xs'
                            : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#FAF7F2] hover:text-[#1E293B]'
                        }`}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Input Tanggal Tunggal */}
              {periodPreset === 'single' && (
                <div className="pt-2">
                  <div className="p-3 bg-[#FAF7F2] border border-[#EDE8DF] rounded-2xl flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#1E293B]">Tanggal Laporan:</span>
                    <input
                      type="date"
                      value={selectedSingleDate}
                      onChange={(e) => setSelectedSingleDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
                    />
                  </div>
                </div>
              )}

              {/* Input Rentang Tanggal Terhubung */}
              {periodPreset === 'range' && (
                <div className="pt-2 space-y-2">
                  <div className="p-3 bg-[#FAF7F2] border border-[#EDE8DF] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-[130px] space-y-1">
                        <span className="text-[11px] font-bold text-[#6B7B8D]">Dari Tanggal:</span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
                        />
                      </div>
                      <span className="text-sm font-bold text-[#8C9BA8] pt-4">➔</span>
                      <div className="flex-1 min-w-[130px] space-y-1">
                        <span className="text-[11px] font-bold text-[#6B7B8D]">Sampai Tanggal:</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className={`w-full px-3 py-1.5 rounded-xl border bg-white text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3A6B80] ${
                            isDateRangeInvalid ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#EDE8DF]'
                          }`}
                        />
                      </div>
                    </div>

                    {isDateRangeInvalid && (
                      <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 pt-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Tanggal akhir tidak boleh mendahului tanggal awal.</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SEKSI 3: Filter Tambahan Opsional (Accordion Collapsed) */}
            <div className="border border-[#EDE8DF] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                className="w-full px-3.5 py-2.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] flex items-center justify-between text-xs font-bold text-[#1E293B] cursor-pointer transition select-none"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-[#3A6B80]" />
                  <span>Filter Tambahan (Kategori & Supplier)</span>
                  {(categoryFilter !== 'ALL' || supplierFilter) && (
                    <span className="w-2 h-2 rounded-full bg-[#3A6B80]" />
                  )}
                </div>
                {isFilterExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7B8D]" /> : <ChevronDown className="w-4 h-4 text-[#6B7B8D]" />}
              </button>

              {isFilterExpanded && (
                <div className="p-3.5 bg-white space-y-3 border-t border-[#EDE8DF]">
                  {/* Pilihan Kategori */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D] block">Kategori Barang:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {INBOUND_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition ${
                            categoryFilter === cat.id
                              ? 'bg-[#3A6B80] text-white border-[#3A6B80]'
                              : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#FAF7F2]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Filter Supplier */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D] block">Nama Supplier (Opsional):</span>
                    <input
                      type="text"
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      placeholder="Ketik nama supplier..."
                      className="w-full px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SEKSI 4: Ringkasan Live Preview di Atas Tombol */}
            <div className="p-3.5 bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-[#6B7B8D] uppercase tracking-wider block">
                Ringkasan Ekspor
              </span>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-[#1E293B] font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-[#3A6B80] shrink-0" />
                  <span>{effectiveLabel}</span>
                </div>

                <div className="text-right">
                  {isLoadingPreview ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7B8D]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Menghitung...</span>
                    </span>
                  ) : totalRecordCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF5EE] text-[#2F7D5B] border border-[#CBEAD6]">
                      {totalRecordCount} {reportType === 'INVENTORY' ? 'Jenis Barang' : 'Transaksi'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      0 Data
                    </span>
                  )}
                </div>
              </div>

              {!isLoadingPreview && totalRecordCount === 0 && (
                <p className="text-[11px] text-amber-700 font-medium pt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Tidak ada data transaksi pada periode &amp; filter ini.</span>
                </p>
              )}
            </div>

            {/* Pesan Error Jika Ada */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Sticky Footer CTA - Min Height 48px */}
          <div className="p-4 sm:p-5 border-t border-[#EDE8DF] bg-white shrink-0">
            <button
              type="button"
              disabled={isExportDisabled}
              onClick={handleDownloadExcel}
              className={`w-full h-12 min-h-[48px] rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98 ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : isExportDisabled
                  ? 'bg-neutral-200 text-neutral-400 border border-neutral-300 cursor-not-allowed shadow-none'
                  : 'bg-[#3A6B80] hover:bg-[#2C3E50] active:bg-[#1E293B] text-white'
              }`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyiapkan File Excel...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-5 h-5 text-white stroke-[2.5]" />
                  <span>File Berhasil Diunduh!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Unduh Excel{' '}
                    {totalRecordCount > 0 ? `(${totalRecordCount} ${reportType === 'INVENTORY' ? 'Barang' : 'Baris'})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

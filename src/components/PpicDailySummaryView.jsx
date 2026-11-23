import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { useProduction1Store } from '../store/production1Store'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { exportPpicRecapExcel } from '../utils/excelExport'
import { SummaryCardSkeleton, DivisionCardSkeleton } from './ui/Skeleton'
import { SquarePen, Lock, ChevronRight, RefreshCw, Info } from 'lucide-react'
import { canAccess } from '../utils/rbac'
import { apiGet } from '../utils/api'

const DIVISION_CONFIG = [
  { id: 'DAGING', name: 'Daging (Giling & Mix)', defaultUnit: 'Gilingan', unitLabel: 'gilingan', station: 'MEAT', stage: 'PROD_1', perm: 'meat:view' },
  { id: 'BUMBU', name: 'Bumbu Sparta', defaultUnit: 'Karung', unitLabel: 'karung', station: 'SEASONING', stage: 'PROD_1', perm: 'seasoning:view' },
  { id: 'KULIT', name: 'Kulit Pangsit', defaultUnit: 'BAL', unitLabel: 'bal', station: 'WRAPPER', stage: 'PROD_1', perm: 'wrapper:view' },
  { id: 'SAOS', name: 'Saos Dimsum', defaultUnit: 'BAL', unitLabel: 'bal', station: 'SAUCE', stage: 'PROD_1', perm: 'sauce:view' },
  { id: 'CETAK', name: 'Meja Cetak', defaultUnit: 'PCS', unitLabel: 'pcs', prod2Tab: 'ASSEMBLY', stage: 'PROD_2', perm: 'prod2_assembly:view' },
  { id: 'PACKING', name: 'Meja Packing', defaultUnit: 'PACK', unitLabel: 'pack', prod2Tab: 'FREEZER', stage: 'PROD_2', perm: 'prod2_packing:view' }
]

const getTodayStr = () => new Date().toISOString().slice(0, 10)
const getYesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function PpicDailySummaryView() {
  const [filterPreset, setFilterPreset] = useState('today') // 'today' | 'yesterday' | 'single' | 'range'
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [rangeStartDate, setRangeStartDate] = useState(getTodayStr())
  const [rangeEndDate, setRangeEndDate] = useState(getTodayStr())

  const [selectedDivForEdit, setSelectedDivForEdit] = useState(null)
  const [rejectCountInput, setRejectCountInput] = useState('')
  const [rejectNotesInput, setRejectNotesInput] = useState('')
  const [opNotesInput, setOpNotesInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [loadingRecap, setLoadingRecap] = useState(true)

  // State untuk Rekonsiliasi / Void Sisa QR yang tidak diproduksi
  const [selectedDivForVoid, setSelectedDivForVoid] = useState(null)
  const [selectedVoidLots, setSelectedVoidLots] = useState(() => new Set())
  const [voidReason, setVoidReason] = useState('Sisa rencana harian tidak terealisasi')
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidSuccess, setVoidSuccess] = useState(false)

  const dailyRecapData = useProduction1Store((s) => s.dailyRecapData)
  const fetchDailyRecap = useProduction1Store((s) => s.fetchDailyRecap)
  const saveDailyNote = useProduction1Store((s) => s.saveDailyNote)
  const voidLots = useProduction1Store((s) => s.voidLots)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const navigateToRoute = useProduction1Store((s) => s.navigateToRoute)

  const todayStr = getTodayStr()
  const isRange = filterPreset === 'range'
  const isHistorical = filterPreset === 'range' || filterPreset === 'yesterday' || (filterPreset === 'single' && selectedDate !== todayStr)

  const activeExportDateStr = isRange
    ? `${rangeStartDate} s/d ${rangeEndDate}`
    : selectedDate

  // State Real-Time Inventory Finished Goods (Stok Gudang Sales & Freezer)
  const [inventoryList, setInventoryList] = useState([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [lastInventoryUpdated, setLastInventoryUpdated] = useState(null)

  const fetchInventory = useCallback(async () => {
    try {
      setLoadingInventory(true)
      const res = await apiGet('/pos/inventory-summary', { silent: true })
      if (res && res.success && Array.isArray(res.data)) {
        setInventoryList(res.data)
        const now = new Date()
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        setLastInventoryUpdated(`${hh}.${mm}`)
      }
    } catch (err) {
      console.warn('Failed to load inventory in PPIC Recap:', err?.message)
    } finally {
      setLoadingInventory(false)
    }
  }, [])

  const loadRecap = useCallback(async () => {
    setLoadingRecap(true)
    try {
      if (filterPreset === 'range') {
        await fetchDailyRecap(rangeStartDate, rangeEndDate)
      } else {
        await fetchDailyRecap(selectedDate)
      }
      fetchInventory()
    } finally {
      setLoadingRecap(false)
    }
  }, [fetchDailyRecap, filterPreset, rangeStartDate, rangeEndDate, selectedDate, fetchInventory])

  useEffect(() => {
    fetchDailyRecap(todayStr)
    fetchInventory()
  }, [fetchDailyRecap, todayStr, fetchInventory])

  const applyPreset = (preset) => {
    setFilterPreset(preset)
    if (preset === 'today') {
      const t = getTodayStr()
      setSelectedDate(t)
      fetchDailyRecap(t)
    } else if (preset === 'yesterday') {
      const y = getYesterdayStr()
      setSelectedDate(y)
      fetchDailyRecap(y)
    } else if (preset === 'single') {
      fetchDailyRecap(selectedDate)
    } else if (preset === 'range') {
      fetchDailyRecap(rangeStartDate, rangeEndDate)
    }
  }

  // Buka Sheet / Modal Void Sisa QR
  const openVoidModal = (divConfig, divData) => {
    if (isHistorical) return
    setSelectedDivForVoid({ config: divConfig, data: divData })
    const pending = divData.pending_lots || []
    setSelectedVoidLots(new Set(pending.map((p) => p.lot_qr_code)))
    setVoidReason('Sisa rencana harian tidak terealisasi')
  }

  const toggleSelectAllVoid = () => {
    if (!selectedDivForVoid) return
    const pending = selectedDivForVoid.data?.pending_lots || []
    if (selectedVoidLots.size === pending.length) {
      setSelectedVoidLots(new Set())
    } else {
      setSelectedVoidLots(new Set(pending.map((p) => p.lot_qr_code)))
    }
  }

  const toggleVoidLot = (code) => {
    setSelectedVoidLots((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const handleConfirmVoid = async () => {
    if (!selectedDivForVoid || selectedVoidLots.size === 0) return
    setIsVoiding(true)
    try {
      const codes = Array.from(selectedVoidLots)
      const ok = await voidLots(codes, voidReason)
      if (ok) {
        setVoidSuccess(true)
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(40)
          }
        } catch {
          // ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 600))
        setSelectedDivForVoid(null)
        setVoidSuccess(false)
        setFeedback({
          type: 'success',
          message: `${codes.length} QR berhasil dibatalkan (VOID). Scanner stasiun otomatis menolak stiker ini jika discan.`
        })
        loadRecap()
      } else {
        setFeedback({
          type: 'error',
          message: 'Gagal membatalkan QR terpilih. Silakan coba lagi.'
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat membatalkan QR.'
      })
    } finally {
      setIsVoiding(false)
    }
  }

  const openEditModal = (divConfig) => {
    if (isHistorical) return
    const currentRecap = dailyRecapData?.divisions?.[divConfig.id] || {}
    setSelectedDivForEdit(divConfig)
    setRejectCountInput(currentRecap.reject_count !== undefined ? String(currentRecap.reject_count) : '0')
    setRejectNotesInput(currentRecap.reject_notes || '')
    setOpNotesInput(currentRecap.operational_notes || '')
    setFeedback(null)
  }

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (!selectedDivForEdit || isHistorical) return

    setSavingNote(true)
    setFeedback(null)
    try {
      await saveDailyNote({
        division: selectedDivForEdit.id,
        reject_count: parseInt(rejectCountInput, 10) || 0,
        reject_notes: rejectNotesInput.trim() || null,
        operational_notes: opNotesInput.trim() || null,
        created_by: operatorName || operatorId || 'PPIC-AYU'
      })
      setNoteSuccess(true)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40)
        }
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, 600))
      setSelectedDivForEdit(null)
      setNoteSuccess(false)
      setFeedback({ type: 'success', message: `Catatan divisi ${selectedDivForEdit.name} berhasil disimpan.` })
      loadRecap()
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Gagal menyimpan catatan.' })
    } finally {
      setSavingNote(false)
    }
  }

  const handleExportExcel = () => {
    exportPpicRecapExcel({
      dateStr: activeExportDateStr,
      recapData: dailyRecapData,
      operatorName: operatorName || 'Ayu (PPIC)'
    })
  }

  const divisions = useMemo(() => dailyRecapData?.divisions || {}, [dailyRecapData?.divisions])
  const bumbuUsage = useMemo(() => dailyRecapData?.bumbu_usage || {
    total_initial: 0,
    total_used: 0,
    total_remaining: 0,
    unit: 'KRESEK',
    records: []
  }, [dailyRecapData?.bumbu_usage])
  const rawMaterialUsage = useMemo(() => dailyRecapData?.raw_material_usage || {
    total_records: 0,
    records: [],
    by_division: { BUMBU: [], KULIT: [], DAGING: [] },
    summary_by_item: []
  }, [dailyRecapData?.raw_material_usage])

  const [rawMaterialTab, setRawMaterialTab] = useState('ALL') // 'ALL' | 'BUMBU' | 'KULIT' | 'DAGING'
  const filteredMaterialRecords = useMemo(() => {
    const list = rawMaterialUsage.records || []
    if (rawMaterialTab === 'ALL') return list
    return list.filter((r) => r.division === rawMaterialTab)
  }, [rawMaterialUsage.records, rawMaterialTab])

  const divisionFilterTabs = useMemo(() => {
    const bumbuCount = rawMaterialUsage.by_division?.BUMBU?.length || 0
    const kulitCount = rawMaterialUsage.by_division?.KULIT?.length || 0
    const dagingCount = rawMaterialUsage.by_division?.DAGING?.length || 0

    const tabs = [{ id: 'ALL', label: 'Semua' }]
    if (bumbuCount > 0) tabs.push({ id: 'BUMBU', label: 'Bumbu' })
    if (kulitCount > 0) tabs.push({ id: 'KULIT', label: 'Kulit' })
    if (dagingCount > 0) tabs.push({ id: 'DAGING', label: 'Giling & Mix' })

    return tabs
  }, [rawMaterialUsage])

  useEffect(() => {
    if (rawMaterialTab !== 'ALL' && !divisionFilterTabs.some((t) => t.id === rawMaterialTab)) {
      setRawMaterialTab('ALL')
    }
  }, [divisionFilterTabs, rawMaterialTab])
  const primaryOfficer = useMemo(() => {
    const officers = DIVISION_CONFIG.map((d) => divisions[d.id]?.updated_by).filter(Boolean)
    if (officers.length === 0) return operatorName || operatorId || 'PPIC-AYU'
    const counts = {}
    officers.forEach((o) => {
      counts[o] = (counts[o] || 0) + 1
    })
    let top = officers[0]
    let max = 0
    for (const [name, count] of Object.entries(counts)) {
      if (count > max) {
        max = count
        top = name
      }
    }
    return top || operatorName || operatorId || 'PPIC-AYU'
  }, [divisions, operatorName, operatorId])
  const totalReject = Object.values(divisions).reduce(
    (acc, div) => acc + (typeof div.reject_count === 'number' ? div.reject_count : 0),
    0
  )
  const totalLots = Object.values(divisions).reduce(
    (acc, div) => acc + (typeof div.total_lots === 'number' ? div.total_lots : 0),
    0
  )

  const containerRef = useRef(null)
  const hasAnimatedRef = useRef(false)

  // Animasi masuk ringan hanya SEKALI saat mount pertama (tanpa scroll-triggered reveal per card)
  useGSAP(
    () => {
      if (typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      if (hasAnimatedRef.current) return
      hasAnimatedRef.current = true

      gsap.from(containerRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.35,
        ease: 'power2.out',
        clearProps: 'all'
      })
    },
    { scope: containerRef, dependencies: [] }
  )

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto space-y-5 font-sans pb-28">
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between ${feedback.type === 'success'
            ? 'bg-[#EBF7EE] text-[#1E7E34] border border-[#C3E6CB]'
            : 'bg-[#FDF0ED] text-[#D32F2F] border border-[#F5C6CB]'
            }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-3 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar Filter Tanggal & Periode */}
      <div className="bg-white border border-[#EDE8DF] rounded-3xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-stretch gap-1.5 p-1 bg-[#F5F1EB] rounded-2xl w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'today'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => applyPreset('yesterday')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'yesterday'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Kemarin
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'single'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Pilih Tanggal
          </button>
          <button
            type="button"
            onClick={() => applyPreset('range')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'range'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Rentang Tanggal
          </button>
        </div>

        {/* Input Tanggal Tunggal */}
        {filterPreset === 'single' && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
            <span className="text-xs font-bold text-[#6B7B8D]">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value
                setSelectedDate(val)
                if (val) fetchDailyRecap(val)
              }}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
          </div>
        )}

        {/* Input Rentang Tanggal */}
        {filterPreset === 'range' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EDE8DF]">
            <span className="text-xs font-bold text-[#6B7B8D]">Dari:</span>
            <input
              type="date"
              value={rangeStartDate}
              onChange={(e) => setRangeStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
            <span className="text-xs font-bold text-[#6B7B8D]">Sampai:</span>
            <input
              type="date"
              value={rangeEndDate}
              onChange={(e) => setRangeEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
            <button
              type="button"
              onClick={() => {
                if (rangeStartDate && rangeEndDate) {
                  fetchDailyRecap(rangeStartDate, rangeEndDate)
                }
              }}
              className="px-3.5 py-1.5 bg-[#3A6B80] hover:bg-[#2C3E50] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* Skeletons saat data pertama kali dimuat */}
      {loadingRecap && !dailyRecapData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </div>
          <div className="space-y-3">
            <DivisionCardSkeleton />
            <DivisionCardSkeleton />
            <DivisionCardSkeleton />
          </div>
        </div>
      ) : (
        <>
          {/* Ringkasan Ringkas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
              <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
                Target Gilingan
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#2C3E50] mt-1">
                {dailyRecapData?.target_gilingan || 0}
              </div>
              <div className="text-[11px] text-[#6B7B8D] mt-0.5">Target shift</div>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
              <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
                Barcode Terbit
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#4685ac] mt-1">
                {totalLots}
              </div>
              <div className="text-[11px] text-[#6B7B8D] mt-0.5">Total lot terbit</div>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
              <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
                Total Reject
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#D32F2F] mt-1">
                {totalReject}
              </div>
              <div className="text-[11px] text-[#6B7B8D] mt-0.5">Semua stasiun</div>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
              <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
                Barang Masuk
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#3A6B80] mt-1">
                {dailyRecapData?.supplier_inbound?.length || 0}
              </div>
              <div className="text-[11px] text-[#6B7B8D] mt-0.5">Inbound supplier</div>
            </div>
          </div>

          {/* Tombol Unduh Excel */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleExportExcel}
              className="min-h-[44px] px-4 py-2 bg-white hover:bg-[#F5F1EB] active:bg-[#EDE8DF] border border-[#3A6B80] text-[#3A6B80] text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3A6B80] shadow-2xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Unduh Excel</span>
            </button>
          </div>

          {/* Daftar Kartu Rekap Per Divisi */}
          <div className="space-y-4">
            {DIVISION_CONFIG.map((divConfig) => {
              const divData = divisions[divConfig.id] || {}
              const hasDiffOfficer = Boolean(divData.updated_by && divData.updated_by !== primaryOfficer)
              const canOpenStation = canAccess(divConfig.perm, currentUser, isDevMode)

              const stationMaterials = (divData.raw_materials && divData.raw_materials.length > 0)
                ? divData.raw_materials
                : (divConfig.id === 'DAGING' && bumbuUsage.records && bumbuUsage.records.length > 0
                  ? bumbuUsage.records.map((b) => ({
                      id: b.id || b.lot_qr_code,
                      item_name: b.item_name || 'Bumbu Sparta',
                      quantity_used: b.quantity_used,
                      initial_quantity: b.initial_quantity,
                      unit: b.unit || 'kresek'
                    }))
                  : [])
              const hasStationUsage = stationMaterials.length > 0 && stationMaterials.some((m) => Number(m.quantity_used) > 0)

              const handleStationClick = () => {
                if (!canOpenStation) return
                if (divConfig.stage === 'PROD_2') {
                  navigateToRoute({ stage: 'PROD_2', prod2Tab: divConfig.prod2Tab })
                } else {
                  navigateToRoute({ stage: 'PROD_1', station: divConfig.station })
                }
              }

              return (
                <div
                  key={divConfig.id}
                  className="border border-bg-cream-dark shadow-2xs rounded-2xl bg-white overflow-hidden"
                >
                  {/* Header Card Satu Baris */}
                  <div
                    onClick={canOpenStation ? handleStationClick : undefined}
                    className={`px-4 py-2 flex items-center justify-between border-b border-bg-cream-dark select-none ${
                      canOpenStation
                        ? 'cursor-pointer hover:bg-[#F5F1EB]/60 active:bg-[#EDE8DF]/70 transition-colors'
                        : ''
                    }`}
                    title={canOpenStation ? `Buka Halaman ${divConfig.name}` : undefined}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <h2 className="text-sm font-bold text-text-primary tracking-tight">
                        {divConfig.name}
                      </h2>
                      {canOpenStation && (
                        <ChevronRight className="w-4 h-4 text-[#3A6B80] shrink-0" />
                      )}
                      {hasDiffOfficer && (
                        <span className="text-[11px] font-medium text-text-secondary bg-bg-cream px-2 py-0.5 rounded-md border border-bg-cream-dark">
                          Petugas: {divData.updated_by}
                        </span>
                      )}
                      {divData.reject_count > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-red/10 text-brand-red border border-brand-red/20">
                          {divData.reject_count} Reject
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isHistorical ? (
                        <div
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary/60"
                          title="Arsip Riwayat"
                          aria-label="Arsip Riwayat"
                        >
                          <Lock className="w-5 h-5" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(divConfig)
                          }}
                          aria-label="Catat Reject & Kendala"
                          title="Catat Reject & Kendala"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-brand-blue hover:text-brand-blue-dark hover:bg-bg-cream active:scale-95 transition-all cursor-pointer focus-visible:outline-none"
                        >
                          <SquarePen className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metrik Satu Baris */}
                  {divConfig.id === 'CETAK' ? (
                    <div className="grid grid-cols-2 gap-3 px-4 py-3">
                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Adonan Diterima
                        </div>
                        <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                          {divData.adonan_received_count || 0} <span className="text-xs font-normal text-text-secondary">gilingan</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Kulit Diterima
                        </div>
                        <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                          {divData.kulit_received_count || 0} <span className="text-xs font-normal text-text-secondary">bal</span>
                        </div>
                      </div>
                    </div>
                  ) : divConfig.id === 'PACKING' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3">
                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Target Rencana
                        </div>
                        <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                          {divData.target_pack || 0} <span className="text-xs font-normal text-text-secondary">pack</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Sudah Scan (Packing)
                        </div>
                        <div className="text-lg font-semibold text-brand-blue-dark tabular-nums mt-0.5">
                          {divData.scan_pack || 0} <span className="text-xs font-normal text-text-secondary">pack</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Audit Penjualan
                        </div>
                        <div className="text-lg font-semibold text-brand-green-dark tabular-nums mt-0.5">
                          {divData.sales_pack || 0} <span className="text-xs font-normal text-text-secondary">pack</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Selisih (Audit)
                        </div>
                        <div className={`text-lg font-semibold tabular-nums mt-0.5 ${
                          (divData.selisih_sales || 0) === 0
                            ? 'text-brand-green-dark'
                            : (divData.selisih_sales || 0) > 0
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}>
                          {(divData.selisih_sales || 0) > 0 ? `+${divData.selisih_sales}` : (divData.selisih_sales || 0)} <span className="text-xs font-normal text-text-secondary">pack</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3">
                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Target
                        </div>
                        <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                          {divData.total_lots || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.unitLabel || 'lot'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Realisasi Selesai
                        </div>
                        <div className="text-lg font-semibold text-brand-green-dark tabular-nums mt-0.5">
                          {divData.completed_count || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.unitLabel || 'lot'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Sisa Belum Dibuat
                        </div>
                        <div className={`text-lg font-semibold tabular-nums mt-0.5 ${(divData.printed_count || 0) > 0 ? 'text-amber-600' : 'text-text-secondary'}`}>
                          {divData.printed_count || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.unitLabel || 'lot'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                          Batal (VOID)
                        </div>
                        <div className={`text-lg font-semibold tabular-nums mt-0.5 ${(divData.void_count || 0) > 0 ? 'text-rose-600' : 'text-text-secondary'}`}>
                          {divData.void_count || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.unitLabel || 'lot'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sub-metrik Pemakaian Bahan Baku Divisi */}
                  {hasStationUsage && (
                    <div
                      onClick={() => {
                        const el = document.getElementById('section-pemakaian-bahan')
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth' })
                          setRawMaterialTab(divConfig.id)
                        }
                      }}
                      className="px-4 py-3 border-t border-[#EDE8DF] cursor-pointer hover:bg-[#F5F1EB]/40 transition-colors space-y-2.5"
                      title="Ketuk untuk melihat detail pemakaian bahan baku"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase text-text-secondary leading-tight">
                          Bahan Baku
                        </div>
                        {stationMaterials.length > 2 && (
                          <span className="text-[11px] font-medium text-[#4685ac] hover:underline">
                            +{stationMaterials.length - 2} lainnya
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {stationMaterials.slice(0, 2).map((m, idx) => {
                          const used = Number(m.quantity_used) || 0
                          const total = Number(m.initial_quantity) || 0
                          const unit = (m.unit || 'kg').toLowerCase()
                          const isExceeded = total > 0 && used > total
                          const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0

                          return (
                            <div key={m.id || idx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[#2C3E50] truncate mr-2">
                                  {m.item_name}
                                </span>
                                <span className="tabular-nums shrink-0 text-xs">
                                  <strong className={isExceeded ? 'text-rose-600 font-bold' : 'font-bold text-[#2C3E50]'}>
                                    {used}
                                  </strong>
                                  <span className="text-[#6B7B8D]"> / {total} {unit}</span>
                                </span>
                              </div>
                              <div className="w-full h-1 bg-[#F5F1EB] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${isExceeded ? 'bg-rose-500' : 'bg-[#4685ac]'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Alert & Tombol Rekonsiliasi Sisa QR */}
                  {(divData.printed_count || 0) > 0 && !isHistorical && (
                    <div className="px-4 py-2.5 bg-amber-50/80 border-t border-amber-200/70 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-amber-900 font-medium min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span className="truncate">
                          Ada <strong>{divData.printed_count} QR</strong> belum dikerjakan (sisa stiker fisik)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openVoidModal(divConfig, divData)}
                        className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold rounded-lg text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Batalkan Sisa QR</span>
                      </button>
                    </div>
                  )}

                  {/* Catatan Reject & Operasional (Hanya jika ada isinya) */}
                  {(divData.reject_notes || divData.operational_notes) && (
                    <div className="px-4 pb-3 pt-2.5 border-t border-bg-cream-dark space-y-1 text-xs">
                      {divData.reject_notes && (
                        <div className="leading-relaxed">
                          <span className="font-semibold text-text-primary">Alasan Reject: </span>
                          <span className="text-text-secondary">{divData.reject_notes}</span>
                        </div>
                      )}
                      {divData.operational_notes && (
                        <div className="leading-relaxed">
                          <span className="font-semibold text-text-primary">Catatan Operasional: </span>
                          <span className="text-text-secondary">{divData.operational_notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* REKAPITULASI PEMAKAIAN BAHAN BAKU (REAL-TIME) */}
          <div id="section-pemakaian-bahan" className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#EDE8DF] pb-2.5">
              <h3 className="text-sm font-bold text-[#2C3E50]">
                Pemakaian Bahan Baku
              </h3>

              {/* Filter Tab Divisi Bahan Baku (Chips tanpa angka) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {divisionFilterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRawMaterialTab(tab.id)}
                    className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      rawMaterialTab === tab.id
                        ? 'bg-white text-[#2C3E50] shadow-2xs border border-[#EDE8DF]'
                        : 'text-[#6B7B8D] hover:text-[#2C3E50] bg-[#F5F1EB]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daftar Kartu Ringkas Bahan Baku */}
            {filteredMaterialRecords.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B7B8D]">
                Belum ada pemakaian
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMaterialRecords.map((item) => {
                  const unit = (item.unit || 'kg').toLowerCase()
                  const initial = Number(item.initial_quantity) || 0
                  const used = Number(item.quantity_used) || 0
                  const remaining = (item.remaining_quantity !== undefined && item.remaining_quantity !== null)
                    ? Number(item.remaining_quantity)
                    : Math.max(0, initial - used)
                  const hasRemaining = !isNaN(remaining)
                  const pct = initial > 0 ? Math.min(100, Math.max(0, (used / initial) * 100)) : 0

                  return (
                    <div
                      key={item.id}
                      className="border border-[#EDE8DF] rounded-xl bg-white p-3.5 space-y-2.5 shadow-2xs"
                    >
                      {/* Header: Nama Bahan + Chip Divisi */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-[#2C3E50] truncate">
                          {item.item_name}
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F5F1EB] text-[#6B7B8D] border border-[#EDE8DF] shrink-0">
                          {item.division_label || item.division}
                        </span>
                      </div>

                      {/* Kode Lot Muted Satu Baris, Tidak Patah */}
                      <div className="text-[11px] font-mono text-[#6B7B8D] truncate leading-tight">
                        {item.lot_qr_code}
                      </div>

                      <div className="border-t border-[#EDE8DF]" />

                      {/* Grid 3 Kolom ala Kartu Stasiun: DIKIRIM | DIPAKAI | SISA */}
                      <div className={`grid ${hasRemaining ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                        <div>
                          <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate">
                            Dikirim
                          </div>
                          <div className="text-sm sm:text-base font-semibold text-text-primary tabular-nums mt-0.5">
                            {initial} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">{unit}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate">
                            Dipakai
                          </div>
                          <div className="text-sm sm:text-base font-semibold text-text-primary tabular-nums mt-0.5">
                            {used} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">{unit}</span>
                          </div>
                        </div>

                        {hasRemaining && (
                          <div>
                            <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate">
                              Sisa
                            </div>
                            <div className="text-sm sm:text-base font-semibold text-text-primary tabular-nums mt-0.5">
                              {remaining} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">{unit}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress bar tipis */}
                      {initial > 0 && (
                        <div className="w-full h-1 bg-[#F5F1EB] rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full bg-[#4685ac] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* REKAP SALDO STOK BARANG JADI (GUDANG SALES & FREEZER) */}
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-[#2C3E50]">
                  Stok Barang Jadi
                </h3>
                <span
                  title="Stok aktif hasil verifikasi ACC Sales vs antrean di Packing"
                  className="cursor-help text-[#6B7B8D] hover:text-[#2C3E50] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="flex items-center gap-2">
                {lastInventoryUpdated && (
                  <span className="text-[11px] text-[#6B7B8D]">
                    Diperbarui {lastInventoryUpdated}
                  </span>
                )}
                <button
                  type="button"
                  onClick={fetchInventory}
                  disabled={loadingInventory}
                  className="p-1.5 rounded-lg text-[#6B7B8D] hover:text-[#3A6B80] hover:bg-[#F5F1EB] active:scale-95 cursor-pointer transition-all focus-visible:outline-none"
                  title="Perbarui stok"
                  aria-label="Perbarui stok"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInventory ? 'animate-spin text-[#3A6B80]' : ''}`} />
                </button>
              </div>
            </div>

            {inventoryList.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B7B8D]">
                Belum ada data stok barang jadi
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inventoryList.map((item) => {
                  const waitingAcc = Number(item.staged_from_kitchen) || 0
                  const readyStock = Number(item.verified_sales_stock) || 0
                  const soldToday = Number(item.sold_today) || 0
                  const hasWaiting = waitingAcc > 0

                  return (
                    <div
                      key={item.product_id}
                      className="bg-white border border-[#EDE8DF] rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-baseline justify-between gap-2 min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-[#2C3E50] truncate">
                          {item.product_name}
                        </span>
                        {item.spec && (
                          <span className="text-[11px] text-[#6B7B8D] shrink-0">
                            {item.spec}
                          </span>
                        )}
                      </div>

                      <div className="border-t border-[#EDE8DF]" />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate flex items-center gap-1">
                            {hasWaiting && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            )}
                            <span>Menunggu ACC</span>
                          </div>
                          <div className={`text-base sm:text-lg font-semibold tabular-nums mt-0.5 ${
                            hasWaiting ? 'text-[#A8862E]' : 'text-text-primary'
                          }`}>
                            {waitingAcc} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">pack</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate">
                            Siap Jual
                          </div>
                          <div className="text-base sm:text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                            {readyStock} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">pack</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] sm:text-xs uppercase text-text-secondary leading-tight truncate">
                            Terjual
                          </div>
                          <div className="text-base sm:text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                            {soldToday} <span className="text-[10px] sm:text-xs font-normal text-text-secondary">pack</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Edit Catatan & Reject */}
      {selectedDivForEdit && !isHistorical && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-[#EDE8DF] overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#F5F1EB] border-b border-[#EDE8DF] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#2C3E50]">
                  Catatan & Reject: {selectedDivForEdit.name}
                </h3>
                <p className="text-xs text-[#6B7B8D] mt-0.5">
                  Pencatatan reject dan kendala operasional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDivForEdit(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Jumlah Reject
                </label>
                <Input
                  type="number"
                  min="0"
                  value={rejectCountInput}
                  onChange={(e) => setRejectCountInput(e.target.value)}
                  placeholder="0"
                  required
                  disabled={savingNote}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Alasan Reject
                </label>
                <textarea
                  value={rejectNotesInput}
                  onChange={(e) => setRejectNotesInput(e.target.value)}
                  placeholder="Contoh: Daging berlemak keras dipisahkan, kulit kering tepi, sobek saat cetak..."
                  rows={2}
                  disabled={savingNote}
                  className="w-full p-3 rounded-2xl border border-[#EDE8DF] text-xs sm:text-sm text-[#2C3E50] placeholder:text-[#6B7B8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Catatan Kendala Operasional
                </label>
                <textarea
                  value={opNotesInput}
                  onChange={(e) => setOpNotesInput(e.target.value)}
                  placeholder="Contoh: Selesai shift tepat waktu, mesin giling sempat mati listrik 10 menit..."
                  rows={3}
                  disabled={savingNote}
                  className="w-full p-3 rounded-2xl border border-[#EDE8DF] text-xs sm:text-sm text-[#2C3E50] placeholder:text-[#6B7B8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDivForEdit(null)}
                  disabled={savingNote}
                  className="flex-1 min-h-[44px]"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingNote}
                  isSuccess={noteSuccess}
                  successText="Catatan Tersimpan!"
                  disabled={savingNote}
                  className="flex-1 min-h-[44px] bg-[#4685ac] hover:bg-[#3A6B80]"
                >
                  Simpan Catatan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rekonsiliasi & Batalkan Sisa QR (Void) */}
      {selectedDivForVoid && !isHistorical && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-[#EDE8DF] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#F5F1EB] border-b border-[#EDE8DF] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#2C3E50]">
                  Rekonsiliasi Sisa QR - {selectedDivForVoid.config.name}
                </h3>
                <p className="text-xs text-[#556575] mt-0.5">
                  Batalkan stiker QR yang tidak diproduksi untuk mencegah scan fiktif.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDivForVoid(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Ringkasan Status */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#F5F1EB]/50 border border-[#EDE8DF] text-center text-xs">
                <div>
                  <div className="text-text-secondary text-[11px]">Terbit</div>
                  <div className="font-bold text-[#2C3E50] text-sm mt-0.5">{selectedDivForVoid.data.total_lots || 0} lot</div>
                </div>
                <div>
                  <div className="text-text-secondary text-[11px]">Selesai</div>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5">{selectedDivForVoid.data.completed_count || 0} lot</div>
                </div>
                <div>
                  <div className="text-text-secondary text-[11px]">Belum Dibuat</div>
                  <div className="font-bold text-amber-600 text-sm mt-0.5">{selectedDivForVoid.data.printed_count || 0} lot</div>
                </div>
              </div>

              {/* Warning Box */}
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Instruksi SOP: </span>
                Stiker fisik yang belum dipakai harus ditarik/dibuang. Barcode yang dibatalkan otomatis ditolak scanner di seluruh stasiun kerja.
              </div>

              {/* Daftar Lot Pending */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#2C3E50]">
                    Pilih QR yang Dibatalkan ({selectedVoidLots.size}/{selectedDivForVoid.data.pending_lots?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAllVoid}
                    className="text-xs font-semibold text-[#3A6B80] hover:underline cursor-pointer"
                  >
                    {selectedVoidLots.size === (selectedDivForVoid.data.pending_lots?.length || 0)
                      ? 'Lepas Semua'
                      : 'Pilih Semua'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-[#EDE8DF] rounded-2xl divide-y divide-[#EDE8DF] bg-white">
                  {(selectedDivForVoid.data.pending_lots || []).length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#556575]">
                      Tidak ada stiker pending ditemukan.
                    </div>
                  ) : (
                    (selectedDivForVoid.data.pending_lots || []).map((lot) => {
                      const isChecked = selectedVoidLots.has(lot.lot_qr_code)
                      return (
                        <label
                          key={lot.lot_qr_code}
                          className={`flex items-center justify-between p-3 cursor-pointer select-none text-xs transition-colors ${
                            isChecked ? 'bg-[#EEF5F9]' : 'hover:bg-[#FAF7F2]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleVoidLot(lot.lot_qr_code)}
                              className="w-4 h-4 rounded border-[#B7C3CE] text-[#3A6B80] accent-[#3A6B80] cursor-pointer"
                            />
                            <span className="font-mono font-bold text-[#2C3E50]">{lot.lot_qr_code}</span>
                          </div>
                          <span className="text-text-secondary">
                            {lot.quantity} {lot.unit}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Alasan Pembatalan */}
              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1">
                  Alasan Pembatalan
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Misal: Sisa rencana harian tidak terealisasi / mesin dicuci"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EDE8DF] bg-white text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#F5F1EB] border-t border-[#EDE8DF] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDivForVoid(null)}
                disabled={isVoiding}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmVoid}
                loading={isVoiding}
                isSuccess={voidSuccess}
                successText="Berhasil Dibatalkan!"
                disabled={isVoiding || selectedVoidLots.size === 0}
              >
                Batalkan {selectedVoidLots.size} QR (VOID)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots, groupLotsByDay } from '../utils/dateFilter'
import { PlusIcon, MinusIcon, PrinterIcon, ScanIcon, CheckIcon, ScanInIcon } from './Icons'
import ScanFeedbackBanner from './ScanFeedbackBanner'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import ProductsView from './ProductsView'
import StationTargetBanner from './StationTargetBanner'
import { Card, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'
import { SegmentedControl } from './ui/SegmentedControl'
import { Button } from './ui/Button'
import { canOpenQr, canManualDispatch } from '../utils/permissions'
import { exportStationLotsExcel } from '../utils/excelExport'
import { ChevronDown } from 'lucide-react'

function ReceivedLotCard({
  item,
  isSelected,
  isSelecting,
  onToggle,
  onStartSelecting,
  canOpenQr: hasQrPermission = false,
  onShowQr,
  onOpenAdjust
}) {
  const longPressHandlers = useLongPress(
    () => {
      if (!isSelecting) {
        onStartSelecting()
      }
      onToggle()
    },
    () => {
      if (isSelecting) {
        onToggle()
      } else {
        onOpenAdjust()
      }
    }
  )

  return (
    <div
      {...longPressHandlers}
      className={`bg-[#F5F1EB] border rounded-xl p-3 flex items-center justify-between text-xs transition-all duration-150 select-none ${
        isSelected
          ? 'border-[#4685ac] bg-[#EEF5F9] ring-1 ring-[#4685ac]'
          : 'border-[#EDE8DF]'
      } cursor-pointer active:scale-[0.99]`}
    >
      <div className="flex items-center gap-2">
        {isSelecting && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
          />
        )}
        <div>
          <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">{item.lotCode}</span>
          <span className="text-[11px] text-[#6B7B8D] tabular-nums">
            {item.label} · {item.detail}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        {hasQrPermission && (
          <button
            type="button"
            onClick={onShowQr}
            className="h-8 px-2 text-xs text-[#6B7B8D] hover:text-[#2C3E50] bg-white hover:bg-[#EDE8DF] border border-[#EDE8DF] rounded-lg cursor-pointer active:scale-95 shadow-2xs"
            title="Tampilkan QR untuk testing"
          >
            QR
          </button>
        )}
        {!isSelecting && (
          <button
            type="button"
            onClick={onOpenAdjust}
            className="h-8 px-3 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all shadow-2xs bg-[#2C3E50] text-white hover:bg-[#151E27] active:scale-95"
            title="Buka pengaturan penggunaan stok bahan"
          >
            <span>Gunakan</span>
          </button>
        )}
      </div>
    </div>
  )
}

function FgLotCard({
  item,
  isSelected,
  isSelecting,
  isEligible = true,
  onToggle,
  onStartSelecting,
  onReprint,
  actionButton,
  badgeContent
}) {
  const longPressHandlers = useLongPress(
    () => {
      if (!isEligible) return
      if (!isSelecting) {
        onStartSelecting()
      }
      onToggle()
    },
    () => {
      if (isSelecting) {
        if (isEligible) onToggle()
      }
    }
  )

  return (
    <div
      {...(isEligible ? longPressHandlers : {})}
      className={`bg-[#F5F1EB] border rounded-xl p-3 flex items-center justify-between text-xs transition-all duration-150 select-none ${
        isSelected
          ? 'border-[#4685ac] bg-[#EEF5F9] ring-1 ring-[#4685ac]'
          : 'border-[#EDE8DF]'
      } ${isEligible ? 'cursor-pointer active:scale-[0.99]' : 'opacity-85'}`}
    >
      <div>
        <div className="flex items-center gap-2">
          {isSelecting && isEligible && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
            />
          )}
          <div>
            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
              {item.lotCode}
            </span>
            <span className="text-[11px] text-[#6B7B8D] tabular-nums">
              {item.typeName} · {item.createdAt}
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onReprint}
          className="w-9 h-9 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] hover:text-[#2C3E50] cursor-pointer transition-all active:scale-95 shadow-2xs"
          title="Cetak ulang stiker"
          aria-label="Cetak ulang stiker"
        >
          <PrinterIcon className="w-4 h-4" />
        </button>

        {actionButton}
        {badgeContent}
      </div>
    </div>
  )
}

export default function Production2View() {
  const [filterType, setFilterType] = useState('ALL')
  const [packMika, setPackMika] = useState(0)
  const [packVakum, setPackVakum] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedTransitGroups, setExpandedTransitGroups] = useState({})
  const [expandedReceivedGroups, setExpandedReceivedGroups] = useState({})

  const toggleTransitGroup = (groupId) => {
    setExpandedTransitGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const toggleReceivedGroup = (groupId) => {
    setExpandedReceivedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  // State Media Penyesuaian / Pengurangan Stok Bahan Manual
  const [adjustModalLot, setAdjustModalLot] = useState(null)
  const [adjustActionType, setAdjustActionType] = useState('CONSUME_ALL') // 'CONSUME_ALL' | 'CONSUME_PARTIAL'
  const [adjustQtyUsed, setAdjustQtyUsed] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  const activeProd2Tab = useProduction1Store((s) => s.activeProd2Tab)
  const packingSubLine = useProduction1Store((s) => s.packingSubLine)
  const setPackingSubLine = useProduction1Store((s) => s.setPackingSubLine)
  const userRole = useProduction1Store((s) => s.userRole)
  const rawDoughLots = useProduction1Store((s) => s.doughLots)
  const rawWrapperLots = useProduction1Store((s) => s.wrapperLots)
  const rawSauceLots = useProduction1Store((s) => s.sauceLots)
  const rawFinishedGoodsLots = useProduction1Store((s) => s.finishedGoodsLots)

  const doughLots = filterAndSortLots(rawDoughLots, 'TODAY', 'OPERATOR')
  const wrapperLots = filterAndSortLots(rawWrapperLots, 'TODAY', 'OPERATOR')
  const sauceLots = filterAndSortLots(rawSauceLots, 'TODAY', 'OPERATOR')
  const finishedGoodsLots = filterAndSortLots(rawFinishedGoodsLots, 'TODAY', 'OPERATOR')

  const receiveMaterialLot = useProduction1Store((s) => s.receiveMaterialLot)
  const adjustMaterialStock = useProduction1Store((s) => s.adjustMaterialStock)
  const adjustMaterialStockBatch = useProduction1Store((s) => s.adjustMaterialStockBatch)
  const completePackingToFG = useProduction1Store((s) => s.completePackingToFG)
  const verifyPackingFg = useProduction1Store((s) => s.verifyPackingFg)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const dailyPlan = useProduction1Store((s) => s.dailyPlan)

  // Status Produk Jadi (Meja Packing & Laporan Produksi)
  const pendingPackingLots = finishedGoodsLots.filter(
    (f) =>
      (f.status === 'READY_IN_ASSEMBLY_STATION' || f.status === 'PRINTED_PENDING_STOCK_IN') &&
      f.status !== 'VOID' &&
      f.status !== 'CANCELLED'
  )
  const totalReportedLots = finishedGoodsLots.filter(
    (f) =>
      (f.status === 'PACKED_VERIFIED' || f.status === 'IN_FREEZER_STORAGE' || f.status === 'IN_SALES_STOCK') &&
      f.status !== 'VOID' &&
      f.status !== 'CANCELLED'
  )

  // Data Target & Progres Produksi Kemasan (Dimsum Mika & Dimsum Vakum)
  const targetMikaPacks =
    (dailyPlan?.orderMika || 0) + (dailyPlan?.bumperMika || 0) ||
    (dailyPlan?.targetMika || 0) ||
    (dailyPlan?.targetMikaPax || 0) ||
    (dailyPlan?.totalMika || 0)
  const targetVakumPacks =
    (dailyPlan?.orderVakum || 0) + (dailyPlan?.bumperVakum || 0) ||
    (dailyPlan?.targetVakum || 0) ||
    (dailyPlan?.targetVakumPax || 0) ||
    (dailyPlan?.totalVakum || 0)

  const verifiedMikaLots = totalReportedLots.filter(
    (f) =>
      f.productType === 'FG_MIKA' ||
      f.type === 'FG_MIKA' ||
      f.lot_type === 'FG_MIKA' ||
      String(f.lotCode || f.lot_qr_code || '').includes('MIKA')
  )
  const verifiedVakumLots = totalReportedLots.filter(
    (f) =>
      f.productType === 'FG_VAKUM' ||
      f.type === 'FG_VAKUM' ||
      f.lot_type === 'FG_VAKUM' ||
      String(f.lotCode || f.lot_qr_code || '').includes('VAKUM')
  )

  const remainingMikaPacks = Math.max(0, targetMikaPacks - verifiedMikaLots.length)
  const remainingVakumPacks = Math.max(0, targetVakumPacks - verifiedVakumLots.length)
  const fgSelect = useLotMultiSelect(pendingPackingLots)
  const isPIC = canManualDispatch(userRole)

  // 1. Bahan Transit Masuk (dari Produksi 1)
  const transitDough = doughLots.filter((d) => d.status === 'IN_TRANSIT_TO_ASSEMBLY')
  const transitWrapper = wrapperLots.filter((w) => w.status === 'IN_TRANSIT_TO_ASSEMBLY')
  const transitSauce = sauceLots.filter((s) => s.status === 'IN_TRANSIT_TO_FINISHING')

  // Inbound Cetak: Hanya Adonan dan Kulit (Saos dikirim & diterima di Meja Packing / FREEZER)
  const allTransitLots = [
    ...transitDough.map((d) => ({
      lotCode: d.lotCode,
      category: 'DOUGH',
      label: 'Adonan',
      detail: '1 gilingan',
      createdAt: d.createdAt
    })),
    ...transitWrapper.map((w) => ({
      lotCode: w.lotCode,
      category: 'WRAPPER',
      label: w.typeName || (w.type === 'KULIT_7CM' ? 'Kulit 7cm' : 'Kulit 9cm'),
      detail: `${w.balQty || 1} bal (${w.weightKg || 15} kg)`,
      createdAt: w.createdAt
    }))
  ]

  // 2. Bahan Diterima di Meja Produksi 2
  const readyDough = doughLots.filter(
    (d) => d.status === 'IN_ASSEMBLY_STATION' || d.status === 'READY_IN_ASSEMBLY_STATION'
  )
  const readyWrapper = wrapperLots.filter(
    (w) => w.status === 'IN_ASSEMBLY_STATION' || w.status === 'READY_IN_ASSEMBLY_STATION'
  )
  const readySauce = sauceLots.filter(
    (s) => s.status === 'IN_FINISHING_STATION' || s.status === 'READY_IN_FINISHING_STATION'
  )

  const handleExportExcel = () => {
    exportStationLotsExcel({
      stationName: 'Produksi 2: Meja Packing & Produk Jadi',
      divisionCode: 'PACKING',
      dateStr: new Date().toISOString().slice(0, 10),
      lots: finishedGoodsLots,
      operatorName: operatorName || operatorId || 'Operator Packing'
    })
  }

  const allReceivedLots = [
    ...readyDough.map((d) => ({
      lotCode: d.lotCode,
      category: 'DOUGH',
      label: 'Adonan',
      currentQty: 1,
      unit: 'gilingan',
      detail: '1 gilingan',
      createdAt: d.createdAt,
      location: 'Bagian Cetak'
    })),
    ...readyWrapper.map((w) => ({
      lotCode: w.lotCode,
      category: 'WRAPPER',
      label: w.typeName || (w.type === 'KULIT_7CM' ? 'Kulit 7cm' : 'Kulit 9cm'),
      currentQty: Number(w.balQty) || Number(w.quantity) || 1,
      unit: 'bal',
      detail: `${w.balQty || w.quantity || 1} bal (${w.weightKg || 15} kg)`,
      createdAt: w.createdAt,
      location: 'Bagian Cetak'
    }))
  ]


  const filteredTransit = allTransitLots.filter(
    (item) => filterType === 'ALL' || item.category === filterType
  )

  const groupedTransitLots = useMemo(() => {
    const groups = {}
    filteredTransit.forEach((item) => {
      const groupKey = item.category === 'DOUGH' ? 'DOUGH' : `WRAPPER_${item.label}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          category: item.category,
          label: item.category === 'DOUGH' ? 'Adonan' : item.label,
          unit: item.category === 'DOUGH' ? 'gilingan' : 'bal',
          items: []
        }
      }
      groups[groupKey].items.push(item)
    })

    return Object.values(groups).map((group) => {
      const sortedCodes = group.items
        .map((i) => i.lotCode)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      let lotRange = '-'
      if (sortedCodes.length === 1) {
        lotRange = sortedCodes[0]
      } else if (sortedCodes.length > 1) {
        lotRange = `${sortedCodes[0]} s/d ${sortedCodes[sortedCodes.length - 1]}`
      }

      return {
        ...group,
        lotRange
      }
    })
  }, [filteredTransit])
  const filteredReceived = allReceivedLots.filter(
    (item) => filterType === 'ALL' || item.category === filterType
  )

  const groupedReceivedLots = useMemo(() => {
    const groups = {}
    filteredReceived.forEach((item) => {
      const groupKey = item.category === 'DOUGH' ? 'DOUGH' : `WRAPPER_${item.label}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          category: item.category,
          label: item.category === 'DOUGH' ? 'Adonan' : item.label,
          unit: item.unit || (item.category === 'DOUGH' ? 'gilingan' : 'bal'),
          items: []
        }
      }
      groups[groupKey].items.push(item)
    })

    return Object.values(groups).map((group) => {
      const sortedCodes = group.items
        .map((i) => i.lotCode)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      let lotRange = '-'
      if (sortedCodes.length === 1) {
        lotRange = sortedCodes[0]
      } else if (sortedCodes.length > 1) {
        lotRange = `${sortedCodes[0]} s/d ${sortedCodes[sortedCodes.length - 1]}`
      }

      return {
        ...group,
        lotRange
      }
    })
  }, [filteredReceived])

  const receivedSelect = useLotMultiSelect(filteredReceived)

  // Sub-Line Isolasi: MIKA vs VAKUM
  const isLineMika = packingSubLine === 'MIKA'
  const currentPackCount = isLineMika ? packMika : packVakum

  // Handler Media Penyesuaian / Pengurangan Stok Manual
  const handleOpenAdjustModal = (item) => {
    setAdjustModalLot(item)
    setAdjustActionType('CONSUME_ALL')
    setAdjustQtyUsed('')
    setAdjustNotes('')
  }

  const handleSubmitAdjust = async () => {
    if (!adjustModalLot) return
    if (adjustActionType === 'CONSUME_PARTIAL' && (!adjustQtyUsed || Number(adjustQtyUsed) <= 0)) {
      return
    }
    setIsAdjusting(true)
    try {
      const ok = await adjustMaterialStock({
        lotCode: adjustModalLot.lotCode,
        actionType: adjustActionType,
        quantityUsed: adjustActionType === 'CONSUME_PARTIAL' ? Number(adjustQtyUsed) : null,
        notes: adjustNotes
      })
      if (ok) {
        setAdjustModalLot(null)
      }
    } finally {
      setIsAdjusting(false)
    }
  }

  // Handlers Multi-Selection Bahan Sudah Diterima
  const handleBatchConsumeReceived = async () => {
    if (receivedSelect.selectedLots.length === 0) return
    setIsSubmitting(true)
    try {
      const success = await adjustMaterialStockBatch(receivedSelect.selectedLots.map((item) => item.lotCode))
      if (success) {
        receivedSelect.clearSelection()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompletePacking = async () => {
    const qtyToPack = isLineMika ? packMika : packVakum
    if (qtyToPack <= 0) return
    setIsSubmitting(true)
    try {
      const packNote = isLineMika
        ? `Mika: ${packMika} pack`
        : `Vakum: ${packVakum} pack`

      const ok = await completePackingToFG({
        trayCodes: [],
        doughCodes: [],
        wrapperCodes: [],
        mikaQty: isLineMika ? packMika : 0,
        vakumQty: !isLineMika ? packVakum : 0,
        rejectPcs: 0,
        sauceCodes: [],
        notes: packNote
      })
      if (ok) {
        setPackMika(0)
        setPackVakum(0)
      }
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleReprintLot = (lot) => {
    const isMika = lot.type === 'FG_MIKA'
    setPrintModal({
      lotCode: lot.lotCode,
      title: isMika ? 'DIMSUM MIKA (50 PCS)' : 'DIMSUM VAKUM (25 PCS)',
      detail: isMika ? 'Isi 50 Buah · Kulit 9 cm' : 'Isi 25 Buah · Frozen Seal',
      weight: isMika ? '50 pcs' : '25 pcs',
      createdAt: lot.createdAt,
      lotList: [
        {
          lotCode: lot.lotCode,
          title: isMika ? 'DIMSUM MIKA (50 PCS)' : 'DIMSUM VAKUM (25 PCS)',
          detail: isMika ? 'Isi 50 Buah · Kulit 9 cm' : 'Isi 25 Buah · Frozen Seal',
          weight: isMika ? '50 pcs' : '25 pcs',
          createdAt: lot.createdAt
        }
      ]
    })
  }

  const handlePrintSelectedFG = () => {
    if (fgSelect.selectedLots.length === 0) return
    openBatchPrintModal(
      fgSelect.selectedLots.map((item) => {
        const isMika = item.type === 'FG_MIKA'
        return {
          lotCode: item.lotCode,
          title: isMika ? 'DIMSUM MIKA (50 PCS)' : 'DIMSUM VAKUM (25 PCS)',
          detail: isMika ? 'Isi 50 Buah · Kulit 9 cm' : 'Isi 25 Buah · Frozen Seal',
          weight: isMika ? '50 pcs' : '25 pcs',
          createdAt: item.createdAt
        }
      }),
      'BATCH PRODUK JADI'
    )
    fgSelect.clearSelection()
  }

  const handleShowQrTest = (item) => {
    setPrintModal({
      lotCode: item.lotCode,
      title: item.label?.toUpperCase() || item.lotCode,
      detail: item.detail || '',
      weight: item.detail || '',
      createdAt: item.createdAt || new Date().toLocaleTimeString('id-ID', { hour12: false }),
      lotList: [
        {
          lotCode: item.lotCode,
          title: item.label?.toUpperCase() || item.lotCode,
          detail: item.detail || '',
          weight: item.detail || '',
          createdAt: item.createdAt || new Date().toLocaleTimeString('id-ID', { hour12: false })
        }
      ]
    })
  }

  const handleShowBatchQrTest = (items) => {
    if (!items || items.length === 0) return
    const first = items[0]
    setPrintModal({
      lotCode: first.lotCode,
      title: first.label?.toUpperCase() || first.lotCode,
      detail: first.detail || '',
      weight: first.detail || '',
      createdAt: first.createdAt || new Date().toLocaleTimeString('id-ID', { hour12: false }),
      lotList: items.map((it) => ({
        lotCode: it.lotCode,
        title: it.label?.toUpperCase() || it.lotCode,
        detail: it.detail || '',
        weight: it.detail || '',
        createdAt: it.createdAt || new Date().toLocaleTimeString('id-ID', { hour12: false })
      }))
    })
  }

  const pendingMikaCount = pendingPackingLots.filter((l) => l.type === 'FG_MIKA').length
  const pendingVakumCount = pendingPackingLots.filter((l) => l.type === 'FG_VAKUM').length

  const subLineOptions = [
    {
      value: 'MIKA',
      label: 'Dimsum Mika',
      count: pendingMikaCount > 0 ? `${pendingMikaCount} siap` : undefined
    },
    {
      value: 'VAKUM',
      label: 'Dimsum Vakum',
      count: pendingVakumCount > 0 ? `${pendingVakumCount} siap` : undefined
    }
  ]

  return (
    <div className="space-y-3.5 pb-24">
      {/* ===================================================================== */}
      {/* SUBVIEW 1: TERIMA BAHAN (INBOUND) */}
      {/* ===================================================================== */}
      {activeProd2Tab === 'INBOUND' && (
        <div className="space-y-3.5">
          {/* Ringkasan Transit Masuk dengan Tint Stasiun (Adonan & Kulit untuk Cetak) */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-[#D1E4EF] bg-[#EEF5F9] shadow-2xs">
              <CardContent className="p-3 text-center space-y-0.5">
                <span className="text-[11px] text-[#4685ac] font-semibold block">Adonan</span>
                <span className="text-lg font-bold tabular-nums text-[#2C3E50] block">
                  {transitDough.length} <span className="text-xs font-normal text-[#6B7B8D]">gilingan</span>
                </span>
              </CardContent>
            </Card>

            <Card className="border-[#D1E4EF] bg-[#EEF5F9] shadow-2xs">
              <CardContent className="p-3 text-center space-y-0.5">
                <span className="text-[11px] text-[#3A6B80] font-semibold block">Kulit</span>
                <span className="text-lg font-bold tabular-nums text-[#2C3E50] block">
                  {transitWrapper.length} <span className="text-xs font-normal text-[#6B7B8D]">bal</span>
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Tombol Utama Scan In Bahan Masuk Bergaya Halaman Giling */}
          <button
            type="button"
            onClick={() =>
              openCameraScanner({
                mode: 'UNIVERSAL',
                title: 'Scan In Bahan ke Meja Cetak'
              })
            }
            className="w-full min-h-[104px] sm:min-h-[114px] rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-[0.98] select-none shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E50] focus-visible:ring-offset-2 relative overflow-hidden bg-[#4685ac] hover:bg-[#3d7597] text-white"
            title="Scan in bahan masuk (Adonan & Kulit)"
          >
            {/* Bulat-bulat dekorasi di background */}
            <div className="absolute -top-7 -right-7 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute top-1 right-3 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

            {/* Kotak Transparan Ikon */}
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 flex items-center justify-center mb-1.5 border border-white/20 shadow-2xs backdrop-blur-[1px] relative z-10 shrink-0">
              <ScanInIcon size={26} strokeWidth={2.2} className="text-white" />
            </div>

            {/* Label Tebal */}
            <span className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-tight block relative z-10">
              Scan in bahan masuk
            </span>

            {/* Pill Keterangan */}
            <span className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#2C3E50] shadow-2xs tabular-nums block max-w-full truncate leading-tight relative z-10">
              {allTransitLots.length > 0 ? `${allTransitLots.length} kiriman menunggu` : 'Siap scan'}
            </span>
          </button>

          {/* Notifikasi Hasil Scan In */}
          <ScanFeedbackBanner />

          {/* Filter Jenis Bahan */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'DOUGH', label: 'Adonan' },
              { id: 'WRAPPER', label: 'Kulit' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-1.5 text-xs rounded-xl border font-bold transition-all cursor-pointer active:scale-95 ${
                  filterType === tab.id
                    ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                    : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Daftar Menunggu Terima */}
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                <span className="text-xs font-bold text-[#2C3E50] block">
                  Menunggu terima ({filteredTransit.length})
                </span>
                {isPIC && filteredTransit.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleShowBatchQrTest(filteredTransit)}
                    className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2 py-0.5 transition-all active:scale-95 cursor-pointer"
                    title="Tampilkan semua QR wadah transit untuk testing scan"
                  >
                    Lihat QR ({filteredTransit.length})
                  </button>
                )}
              </div>

              {filteredTransit.length === 0 ? (
                <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-4 text-center text-xs text-[#6B7B8D]">
                  Belum ada bahan kiriman masuk.
                </div>
              ) : filterType === 'ALL' ? (
                /* Mode "Semua": Sistem pengelompokan card utama dengan dropdown detail */
                <div className="space-y-2.5">
                  {groupedTransitLots.map((group) => {
                    const isExpanded = !!expandedTransitGroups[group.id]
                    return (
                      <div
                        key={group.id}
                        className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl overflow-hidden transition-all shadow-2xs"
                      >
                        {/* Main Card: Display nama bahan, jumlah, rentang no resi, badge, dan icon dropdown */}
                        <button
                          type="button"
                          onClick={() => toggleTransitGroup(group.id)}
                          className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-[#EDE8DF]/60 active:bg-[#EDE8DF] transition-colors select-none"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-[#2C3E50]">
                                {group.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#4685ac] border border-[#EDE8DF] shadow-2xs tabular-nums">
                                {group.items.length} {group.unit}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6B7B8D] tabular-nums mt-1 font-medium truncate">
                              <span className="text-[#2C3E50] font-bold">No. Resi:</span>{' '}
                              <span className="font-semibold text-[#2C3E50]">{group.lotRange}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="warning" size="sm">
                              Belum di-scan
                            </Badge>
                            <div className="w-6 h-6 rounded-lg bg-white/80 border border-[#EDE8DF] flex items-center justify-center">
                              <ChevronDown
                                className={`w-4 h-4 text-[#6B7B8D] transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[#4685ac]' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </button>

                        {/* Dropdown list item saat card diklik */}
                        {isExpanded && (
                          <div className="border-t border-[#EDE8DF] p-2.5 bg-white space-y-2 animate-in fade-in duration-150">
                            {group.items.map((item) => (
                              <div
                                key={item.lotCode}
                                className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                              >
                                <div>
                                  <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                                    {item.lotCode}
                                  </span>
                                  <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                                    {item.label} · {item.detail}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Badge variant="warning" size="sm">
                                    Belum di-scan
                                  </Badge>
                                  {canOpenQr(userRole) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleShowQrTest(item)
                                      }}
                                      className="h-8 px-2.5 text-xs text-[#2C3E50] hover:text-[#2C3E50] bg-white hover:bg-[#EDE8DF] border border-[#EDE8DF] rounded-lg font-semibold cursor-pointer active:scale-95 transition-all shadow-2xs"
                                      title="Tampilkan QR untuk testing scan"
                                    >
                                      QR
                                    </button>
                                  )}
                                  {isPIC && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        receiveMaterialLot(item.lotCode)
                                      }}
                                      className="h-8 px-2.5 text-xs text-[#4685ac] hover:text-[#3A6B80] underline cursor-pointer font-semibold"
                                      title="Override manual PIC"
                                    >
                                      Terima
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Mode filter spesifik (Adonan / Kulit): Tampilan daftar langsung */
                <div className="space-y-2">
                  {filteredTransit.map((item) => (
                    <div
                      key={item.lotCode}
                      className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                    >
                      <div>
                        <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">{item.lotCode}</span>
                        <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                          {item.label} · {item.detail}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant="warning" size="sm">
                          Belum di-scan
                        </Badge>
                        {canOpenQr(userRole) && (
                          <button
                            type="button"
                            onClick={() => handleShowQrTest(item)}
                            className="h-8 px-2.5 text-xs text-[#2C3E50] hover:text-[#2C3E50] bg-white hover:bg-[#EDE8DF] border border-[#EDE8DF] rounded-lg font-semibold cursor-pointer active:scale-95 transition-all shadow-2xs"
                            title="Tampilkan QR untuk testing scan"
                          >
                            QR
                          </button>
                        )}
                        {isPIC && (
                          <button
                            type="button"
                            onClick={() => receiveMaterialLot(item.lotCode)}
                            className="h-8 px-2.5 text-xs text-[#4685ac] hover:text-[#3A6B80] underline cursor-pointer font-semibold"
                            title="Override manual PIC"
                          >
                            Terima
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daftar Sudah Diterima */}
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                <span className="text-xs font-bold text-[#2C3E50] block">
                  Sudah diterima ({filteredReceived.length})
                </span>

                <div className="flex items-center gap-1.5">
                  {filteredReceived.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        receivedSelect.isSelecting
                          ? receivedSelect.clearSelection()
                          : receivedSelect.startSelecting()
                      }
                      className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer active:scale-95 ${
                        receivedSelect.isSelecting
                          ? 'bg-[#4685ac] text-white border-[#4685ac]'
                          : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                      }`}
                    >
                      {receivedSelect.isSelecting ? 'Selesai' : 'Pilih'}
                    </button>
                  )}

                  {isPIC && filteredReceived.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleShowBatchQrTest(filteredReceived.slice(0, 15))}
                      className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2 py-0.5 transition-all active:scale-95 cursor-pointer"
                      title="Tampilkan QR bahan yang sudah diterima"
                    >
                      QR ({Math.min(filteredReceived.length, 15)})
                    </button>
                  )}
                </div>
              </div>

              {filteredReceived.length === 0 ? (
                <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-4 text-center text-xs text-[#6B7B8D]">
                  Belum ada bahan diterima hari ini.
                </div>
              ) : filterType === 'ALL' ? (
                /* Mode "Semua": Sistem pengelompokan card utama dengan dropdown detail */
                <div className="space-y-2.5">
                  {groupedReceivedLots.map((group) => {
                    const isExpanded = !!expandedReceivedGroups[group.id]
                    const selectedInGroup = group.items.filter((item) =>
                      receivedSelect.selectedCodes.has(item.lotCode)
                    ).length

                    return (
                      <div
                        key={group.id}
                        className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl overflow-hidden transition-all shadow-2xs"
                      >
                        {/* Main Card: Display nama bahan, jumlah, rentang no resi, badge, dan icon dropdown */}
                        <button
                          type="button"
                          onClick={() => toggleReceivedGroup(group.id)}
                          className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-[#EDE8DF]/60 active:bg-[#EDE8DF] transition-colors select-none"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-[#2C3E50]">
                                {group.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#4685ac] border border-[#EDE8DF] shadow-2xs tabular-nums">
                                {group.items.length} {group.unit}
                              </span>
                              {receivedSelect.isSelecting && selectedInGroup > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4685ac] text-white tabular-nums">
                                  {selectedInGroup} dipilih
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B7B8D] tabular-nums mt-1 font-medium truncate">
                              <span className="text-[#2C3E50] font-bold">No. Resi:</span>{' '}
                              <span className="font-semibold text-[#2C3E50]">{group.lotRange}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="success" size="sm">
                              Diterima
                            </Badge>
                            <div className="w-6 h-6 rounded-lg bg-white/80 border border-[#EDE8DF] flex items-center justify-center">
                              <ChevronDown
                                className={`w-4 h-4 text-[#6B7B8D] transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 text-[#4685ac]' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </button>

                        {/* Dropdown list item saat card diklik */}
                        {isExpanded && (
                          <div className="border-t border-[#EDE8DF] p-2.5 bg-white space-y-2 animate-in fade-in duration-150">
                            {group.items.map((item) => (
                              <ReceivedLotCard
                                key={item.lotCode}
                                item={item}
                                isSelected={receivedSelect.selectedCodes.has(item.lotCode)}
                                isSelecting={receivedSelect.isSelecting}
                                onToggle={() => receivedSelect.toggleSelect(item.lotCode)}
                                onStartSelecting={() => receivedSelect.startSelecting()}
                                canOpenQr={canOpenQr(userRole)}
                                onShowQr={() => handleShowQrTest(item)}
                                onOpenAdjust={() => handleOpenAdjustModal(item)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredReceived.map((item) => (
                    <ReceivedLotCard
                      key={item.lotCode}
                      item={item}
                      isSelected={receivedSelect.selectedCodes.has(item.lotCode)}
                      isSelecting={receivedSelect.isSelecting}
                      onToggle={() => receivedSelect.toggleSelect(item.lotCode)}
                      onStartSelecting={() => receivedSelect.startSelecting()}
                      canOpenQr={canOpenQr(userRole)}
                      onShowQr={() => handleShowQrTest(item)}
                      onOpenAdjust={() => handleOpenAdjustModal(item)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBVIEW 2: MEJA PACKING & LAPORAN PRODUKSI (FREEZER) */}
      {/* ===================================================================== */}
      {activeProd2Tab === 'FREEZER' && (
        <div className="space-y-3.5">
          {isPIC ? (
            <>
              {/* Target Harian Finished Goods (1 Baris Ringkas) */}
              <StationTargetBanner type="PROD_2" />

              {/* Tombol Utama Scan Barcode Kemasan Bergaya Halaman Giling */}
              <button
                type="button"
                onClick={() =>
                  openCameraScanner({
                    mode: 'UNIVERSAL',
                    title: 'Scan Barcode Kemasan'
                  })
                }
                className="w-full min-h-[104px] sm:min-h-[114px] rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-[0.98] select-none shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E50] focus-visible:ring-offset-2 relative overflow-hidden bg-[#4685ac] hover:bg-[#3d7597] text-white"
                title="Scan barcode kemasan"
              >
                {/* Bulat-bulat dekorasi di background */}
                <div className="absolute -top-7 -right-7 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute top-1 right-3 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                {/* Kotak Transparan Ikon */}
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 flex items-center justify-center mb-1.5 border border-white/20 shadow-2xs backdrop-blur-[1px] relative z-10 shrink-0">
                  <ScanInIcon size={26} strokeWidth={2.2} className="text-white" />
                </div>

                {/* Label Tebal */}
                <span className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-tight block relative z-10">
                  Scan in kemasan
                </span>
              </button>

              {/* Banner Feedback Scan */}
              <ScanFeedbackBanner />

              {/* Card Penerimaan Saos dari Dapur ke Meja Packing */}
              <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                    <span className="text-xs font-bold text-[#2C3E50] block">
                      Penerimaan Saos dari Dapur
                    </span>
                    <Badge variant={transitSauce.length > 0 ? "warning" : "neutral"} size="sm">
                      {transitSauce.length} kiriman · {readySauce.length} siap
                    </Badge>
                  </div>

                  {transitSauce.length === 0 ? (
                    <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 text-center text-xs text-[#6B7B8D]">
                      Tidak ada bal saos dalam pengiriman.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transitSauce.map((s) => (
                        <div
                          key={s.lotCode}
                          className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                        >
                          <div>
                            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">{s.lotCode}</span>
                            <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                              {s.typeName || (s.type === 'MINI' ? 'Saos mini' : 'Saos reguler')} · 1 bal ({s.type === 'MINI' ? '200 plastik' : '50 pouch'})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Badge variant="warning" size="sm">
                              Belum di-scan
                            </Badge>
                            {isPIC && (
                              <button
                                type="button"
                                onClick={() => receiveMaterialLot(s.lotCode)}
                                className="h-8 px-2.5 text-xs text-[#4685ac] hover:text-[#3A6B80] underline cursor-pointer font-semibold"
                                title="Override manual PIC"
                              >
                                Terima
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>



              {/* Header Kontrol Seleksi & Cetak Hasil Bungkus */}
              <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                    <span className="text-xs font-bold text-[#2C3E50] block">
                      Hasil bungkus hari ini ({finishedGoodsLots.length})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="text-[11px] font-bold rounded-lg px-2.5 py-1 border border-[#3A6B80] text-[#3A6B80] bg-white hover:bg-[#F5F1EB] transition-colors cursor-pointer flex items-center gap-1"
                        title="Unduh laporan Excel produk jadi"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Excel</span>
                      </button>

                      {lastBatchPrintModal?.lotList?.length > 1 && (
                        <button
                          type="button"
                          onClick={reopenLastBatchPrintModal}
                          className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2.5 py-1 transition-all active:scale-95 cursor-pointer"
                          title="Buka kembali QR batch terakhir"
                        >
                          QR ({lastBatchPrintModal.lotList.length})
                        </button>
                      )}

                      {finishedGoodsLots.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            fgSelect.isSelecting
                              ? fgSelect.clearSelection()
                              : fgSelect.startSelecting()
                          }
                          className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer active:scale-95 ${
                            fgSelect.isSelecting
                              ? 'bg-[#4685ac] text-white border-[#4685ac]'
                              : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                          }`}
                        >
                          {fgSelect.isSelecting ? 'Selesai' : 'Pilih'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Section 1: Belum Di-Scan Packing */}
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold text-[#6B7B8D] block">
                      Belum di-scan packing ({pendingPackingLots.length})
                    </span>

                    {pendingPackingLots.length === 0 ? (
                      <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 text-center text-xs text-[#6B7B8D]">
                        Semua kemasan sudah selesai dipacking.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada kemasan siap) */}
                        {fgSelect.isSelecting && pendingPackingLots.length > 0 && (
                          <div
                            onClick={() =>
                              fgSelect.isAllSelected
                                ? fgSelect.clearSelection()
                                : fgSelect.selectAll()
                            }
                            className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={fgSelect.isAllSelected}
                                onChange={() =>
                                  fgSelect.isAllSelected
                                    ? fgSelect.clearSelection()
                                    : fgSelect.selectAll()
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
                              />
                              <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                            </div>
                            <Badge variant="neutral" size="sm" tabular>
                              {pendingPackingLots.length} siap
                            </Badge>
                          </div>
                        )}

                        {groupLotsByDay(pendingPackingLots).map((group) => (
                          <div key={group.dateKey} className="space-y-1.5">
                            <div className="flex items-center justify-between px-0.5 pt-1">
                              <span className="text-[11px] font-bold text-[#6B7B8D]">
                                {group.label}
                              </span>
                              <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                                {group.items.length} kemasan
                              </span>
                            </div>

                            {group.items.map((item) => (
                              <FgLotCard
                                key={item.lotCode}
                                item={item}
                                isSelected={fgSelect.selectedCodes.has(item.lotCode)}
                                isSelecting={fgSelect.isSelecting}
                                isEligible={true}
                                onToggle={() => fgSelect.toggleSelect(item.lotCode)}
                                onStartSelecting={() => fgSelect.startSelecting()}
                                onReprint={() => handleReprintLot(item)}
                                actionButton={
                                  <button
                                    type="button"
                                    onClick={() => verifyPackingFg([item.lotCode])}
                                    className="h-9 px-3 text-xs font-bold bg-[#4685ac] text-white rounded-xl hover:bg-[#3A6B80] active:scale-95 cursor-pointer transition-all shadow-xs"
                                    title="Tandai selesai packing"
                                  >
                                    Selesai
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Sudah Selesai Packing */}
                  {totalReportedLots.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#EDE8DF]">
                      <span className="text-xs font-bold text-[#6B7B8D] block">
                        Sudah selesai packing ({totalReportedLots.length})
                      </span>

                      <div className="space-y-2.5">
                        {groupLotsByDay(totalReportedLots).map((group) => (
                          <div key={group.dateKey} className="space-y-1.5">
                            <div className="flex items-center justify-between px-0.5 pt-1">
                              <span className="text-[11px] font-bold text-[#6B7B8D]">
                                {group.label}
                              </span>
                              <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                                {group.items.length} kemasan
                              </span>
                            </div>

                            {group.items.map((item) => {
                              const isInSales =
                                item.status === 'IN_SALES_STOCK' || item.status === 'IN_FREEZER_STORAGE'
                              const isDistributed = item.status === 'DISTRIBUTED'

                              return (
                                <FgLotCard
                                  key={item.lotCode}
                                  item={item}
                                  isSelected={false}
                                  isSelecting={fgSelect.isSelecting}
                                  isEligible={false}
                                  onToggle={() => {}}
                                  onStartSelecting={() => {}}
                                  onReprint={() => handleReprintLot(item)}
                                  badgeContent={
                                    <Badge
                                      variant={isInSales ? 'success' : isDistributed ? 'neutral' : 'info'}
                                      size="sm"
                                    >
                                      {isInSales ? 'Di POS' : isDistributed ? 'Terkirim' : 'Selesai'}
                                    </Badge>
                                  }
                                />
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* TAMPILAN KHUSUS KARYAWAN PACKING */
            <div className="space-y-3.5">
              {/* 2 Card Target Produksi Kemasan (Sama seperti di Halaman Cetak/Rencana) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                  <CardContent className="p-3 space-y-1">
                    <span className="text-[11px] font-bold text-[#556575] block">Dimsum Mika</span>
                    <div className="mt-0.5">
                      <span className="text-base font-bold tabular-nums text-[#2C3E50]">
                        {verifiedMikaLots.length}
                        <span className="text-xs font-normal text-[#556575]"> / {targetMikaPacks} pack</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                  <CardContent className="p-3 space-y-1">
                    <span className="text-[11px] font-bold text-[#556575] block">Dimsum Vakum</span>
                    <div className="mt-0.5">
                      <span className="text-base font-bold tabular-nums text-[#2C3E50]">
                        {verifiedVakumLots.length}
                        <span className="text-xs font-normal text-[#556575]"> / {targetVakumPacks} pack</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tombol Utama Scan In Kemasan Bergaya Halaman Giling */}
              <button
                type="button"
                onClick={() =>
                  openCameraScanner({
                    mode: 'UNIVERSAL',
                    title: 'Scan QR Kemasan (Verifikasi Masuk)'
                  })
                }
                className="w-full min-h-[104px] sm:min-h-[114px] rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-[0.98] select-none shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E50] focus-visible:ring-offset-2 relative overflow-hidden bg-[#4685ac] hover:bg-[#3d7597] text-white"
                title="Scan in QR kemasan untuk verifikasi"
              >
                {/* Bulat-bulat dekorasi di background */}
                <div className="absolute -top-7 -right-7 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute top-1 right-3 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                {/* Kotak Transparan Ikon */}
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 flex items-center justify-center mb-1.5 border border-white/20 shadow-2xs backdrop-blur-[1px] relative z-10 shrink-0">
                  <ScanInIcon size={26} strokeWidth={2.2} className="text-white" />
                </div>

                {/* Label Tebal */}
                <span className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-tight block relative z-10">
                  Scan in kemasan
                </span>
              </button>

              {/* Notifikasi Hasil Scan In */}
              <ScanFeedbackBanner />

              {/* Daftar Kemasan Belum Di-Scan */}
              <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                    <span className="text-xs font-bold text-[#2C3E50] block">
                      Kemasan belum di-scan ({pendingPackingLots.length})
                    </span>
                  </div>

                  {pendingPackingLots.length === 0 ? (
                    <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-4 text-center text-xs text-[#6B7B8D]">
                      Semua kemasan sudah selesai diverifikasi.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingPackingLots.map((item) => (
                        <div
                          key={item.lotCode}
                          className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                        >
                          <div>
                            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                              {item.lotCode}
                            </span>
                            <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                              {item.typeName} · {item.createdAt}
                            </span>
                          </div>
                          <Badge variant="warning" size="sm">
                            Belum di-scan
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Daftar Kemasan Sudah Di-Scan / Diverifikasi Hari Ini */}
              {totalReportedLots.length > 0 && (
                <Card className="border-[#EDE8DF] bg-white shadow-2xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
                      <span className="text-xs font-bold text-[#2C3E50] block">
                        Sudah diverifikasi ({totalReportedLots.length})
                      </span>
                      <Badge variant="success" size="sm">
                        Selesai
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {totalReportedLots.map((item) => (
                        <div
                          key={item.lotCode}
                          className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                        >
                          <div>
                            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                              {item.lotCode}
                            </span>
                            <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                              {item.typeName} · {item.createdAt}
                            </span>
                          </div>
                          <Badge variant="success" size="sm">
                            Diverifikasi
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBVIEW 4: KATALOG & PENJUALAN PRODUK (PRODUCTS) */}
      {/* ===================================================================== */}
      {activeProd2Tab === 'PRODUCTS' && <ProductsView />}

      {/* Floating Action Bar untuk Bahan Sudah Diterima Terpilih */}
      {activeProd2Tab === 'INBOUND' && (
        <BatchPrintSelectionBar
          selectedCount={receivedSelect.selectedLots.length}
          actionLabel="Tandai habis terpakai"
          onAction={handleBatchConsumeReceived}
          actionDisabled={isSubmitting}
        />
      )}

      {/* Floating Action Bar untuk Batch Aksi Terpilih (Finished Goods) */}
      {activeProd2Tab === 'FREEZER' && (
        <BatchPrintSelectionBar
          selectedCount={fgSelect.selectedLots.length}
          onPrint={handlePrintSelectedFG}
          canOpenQr={canOpenQr(userRole)}
          onScanOut={() =>
            openCameraScanner({
              mode: 'UNIVERSAL',
              title: `Scan Out ${fgSelect.selectedLots.length} Produk Jadi Terpilih`
            })
          }
          scanOutLabel="Scan out"
          onManualDispatch={
            isPIC
              ? () => {
                  verifyPackingFg(fgSelect.selectedLots.map((l) => l.lotCode))
                  fgSelect.clearSelection()
                }
              : undefined
          }
          manualDispatchLabel="Kirim ke POS"
        />
      )}

      {/* Modal Dialog: Catat Penggunaan / Kurangi Stok Bahan Manual */}
      <Modal
        isOpen={Boolean(adjustModalLot)}
        onClose={() => !isAdjusting && setAdjustModalLot(null)}
        title={adjustModalLot?.category === 'DOUGH' ? 'Selesai cetak adonan' : 'Catat penggunaan bahan'}
        subtitle={adjustModalLot ? `${adjustModalLot.lotCode} · ${adjustModalLot.label}` : ''}
        size="sm"
      >
        {adjustModalLot && (
          <div className="space-y-3.5">
            {/* Info Stok Saat Ini */}
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-[#6B7B8D] font-medium">
                {adjustModalLot.category === 'DOUGH' ? 'Jumlah di meja cetak:' : 'Sisa stok di meja:'}
              </span>
              <span className="text-sm font-bold tabular-nums text-[#2C3E50]">
                {adjustModalLot.category === 'DOUGH'
                  ? '1 gilingan'
                  : `${adjustModalLot.currentQty || adjustModalLot.detail} ${adjustModalLot.unit}`}
              </span>
            </div>

            {/* Pilihan Tindakan: Khusus DOUGH selalu habis terpakai per 1 gilingan */}
            {adjustModalLot?.category === 'DOUGH' ? (
              <div className="text-xs text-[#6B7B8D] bg-white border border-[#EDE8DF] rounded-xl p-3 leading-relaxed">
                Tandai 1 gilingan ini jika telah selesai dicetak agar dikeluarkan dari daftar bahan aktif di meja cetak.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustActionType('CONSUME_ALL')}
                  className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 ${
                    adjustActionType === 'CONSUME_ALL'
                      ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-xs'
                      : 'bg-white text-[#2C3E50] hover:bg-[#EDE8DF] border-[#EDE8DF]'
                  }`}
                >
                  Habis terpakai
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustActionType('CONSUME_PARTIAL')}
                  className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 ${
                    adjustActionType === 'CONSUME_PARTIAL'
                      ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-xs'
                      : 'bg-white text-[#2C3E50] hover:bg-[#EDE8DF] border-[#EDE8DF]'
                  }`}
                >
                  Kurangi sebagian
                </button>
              </div>
            )}

            {/* Input Jumlah jika Kurangi Sebagian */}
            {adjustActionType === 'CONSUME_PARTIAL' && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#2C3E50] block">
                  Jumlah yang dipakai ({adjustModalLot.unit || 'unit'})
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={adjustModalLot.currentQty || 100}
                    value={adjustQtyUsed}
                    onChange={(e) => setAdjustQtyUsed(e.target.value)}
                    placeholder={`Misal: 5 (maks ${adjustModalLot.currentQty || 20})`}
                    className="flex-1 h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs tabular-nums font-bold text-[#2C3E50] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 transition-colors shadow-2xs"
                  />
                  <span className="text-xs font-bold text-[#6B7B8D]">
                    {adjustModalLot.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Input Catatan */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#2C3E50] block">
                Catatan (opsional)
              </span>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Catatan jika ada deviasi..."
                className="w-full h-11 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-xs text-[#2C3E50] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 transition-colors shadow-2xs placeholder-[#6B7B8D]"
              />
            </div>

            {/* Tombol Simpan */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                disabled={isAdjusting}
                onClick={() => setAdjustModalLot(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={isAdjusting}
                disabled={
                  isAdjusting ||
                  (adjustActionType === 'CONSUME_PARTIAL' &&
                    (!adjustQtyUsed || Number(adjustQtyUsed) <= 0))
                }
                onClick={handleSubmitAdjust}
              >
                {adjustModalLot.category === 'DOUGH' ? 'Tandai habis terpakai' : 'Simpan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots } from '../utils/dateFilter'
import {
  PrinterIcon,
  ScanIcon,
  MinusIcon,
  PlusIcon,
  ChevronDownIcon,
  XIcon
} from './Icons'
import StationTargetBanner from './StationTargetBanner'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import { Card, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { groupStationLots, getLotSemanticBadge } from '../utils/scanMode'
import { canOpenQr, canManualDispatch, canExportExcel } from '../utils/permissions'
import { exportStationLotsExcel } from '../utils/excelExport'
import ScanActionBar from './ScanActionBar'

function DoughLotCard({
  lot,
  badgeVariant,
  badgeText,
  scanMode = '1X',
  isSelected,
  isSelecting,
  isEligible = true,
  onToggle,
  onStartSelecting,
  canOpenQr: hasQrPermission = false,
  onPrint,
  onVoid
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
      if (isSelecting && isEligible) {
        onToggle()
      } else if (hasQrPermission) {
        onPrint()
      }
    }
  )

  const badge = badgeVariant && badgeText
    ? { variant: badgeVariant, label: badgeText }
    : getLotSemanticBadge(lot.status, scanMode)

  return (
    <div
      {...(isEligible ? longPressHandlers : {})}
      className={`bg-[#F5F1EB] border rounded-xl p-3 flex items-center justify-between text-xs transition-all duration-150 select-none min-h-[58px] ${
        isSelected
          ? 'border-[#4685ac] bg-[#EEF5F9] ring-1 ring-[#4685ac]'
          : 'border-[#EDE8DF]'
      } ${isEligible ? 'cursor-pointer active:scale-[0.99]' : 'opacity-85'}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {isSelecting && isEligible && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer shrink-0"
          />
        )}
        <div className="min-w-0">
          <span className="tabular-nums font-bold text-[#2C3E50] block text-xs whitespace-nowrap">
            {lot.lotCode}
          </span>
          <span className="text-[11px] text-[#6B7B8D] tabular-nums block whitespace-nowrap">
            {lot.createdDate ? `${lot.createdDate} · ` : ''}{lot.createdAt || '--:--'}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 shrink-0"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
        {!isSelecting && hasQrPermission && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPrint()
            }}
            className="w-9 h-9 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
            title="Cetak Ulang Barcode"
            aria-label="Cetak ulang barcode"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
        )}
        {!isSelecting && onVoid && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onVoid()
            }}
            className="w-9 h-9 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 flex items-center justify-center text-rose-600 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
            title="Batalkan Label QR (Tidak Terealisasi)"
            aria-label="Batalkan label"
          >
            <XIcon className="w-4 h-4 text-rose-500" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function MeatStation() {
  const [activeMeatTab, setActiveMeatTab] = useState('GILING') // 'GILING' | 'BUMBU'
  const [isFinishedFolded, setIsFinishedFolded] = useState(true)

  const gilinganInput = 1
  const [isSendingDough, setIsSendingDough] = useState(false)
  const [isReceivingBumbu, setIsReceivingBumbu] = useState(false)

  // State Modal 3-Metrik Pemakaian Bumbu
  const [bumbuModalLot, setBumbuModalLot] = useState(null)
  const [bumbuQtySent, setBumbuQtySent] = useState('')
  const [bumbuQtyUsed, setBumbuQtyUsed] = useState('')
  const [bumbuRemainingAction, setBumbuRemainingAction] = useState('STORE_IN_ROOM')
  const [bumbuNotes, setBumbuNotes] = useState('')
  const [isSavingBumbu, setIsSavingBumbu] = useState(false)

  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const isPIC = canManualDispatch(userRole, currentUser)
  const canExport = canExportExcel(userRole, currentUser)

  const seasoningLots = useProduction1Store((s) => s.seasoningLots)
  const doughLots = useProduction1Store((s) => s.doughLots)
  const meatLots = useProduction1Store((s) => s.meatLots)

  const recordMaterialUsage = useProduction1Store((s) => s.recordMaterialUsage)
  const scanInSeasoningBatch = useProduction1Store((s) => s.scanInSeasoningBatch)
  const scanOutAllDough = useProduction1Store((s) => s.scanOutAllDough)
  const voidLots = useProduction1Store((s) => s.voidLots)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)

  const filteredDoughLots = filterAndSortLots(doughLots, 'TODAY', 'OPERATOR')
  const filteredSeasoningLots = filterAndSortLots(seasoningLots, 'TODAY', 'OPERATOR')
  const filteredMeatLots = filterAndSortLots(meatLots, 'TODAY', 'OPERATOR')
  const incomingMeatTransit = filteredMeatLots.filter(
    (m) => m.status === 'IN_TRANSIT_TO_MEAT_MIXING' || m.status === 'IN_TRANSIT_TO_MEAT_STATION'
  )

  // Pengelompokan Gilingan sesuai status proses
  const readyLots = filteredDoughLots.filter(
    (l) =>
      (l.status === 'READY_IN_MEAT_MIXING_STATION' ||
      l.status === 'PRINTED_PENDING_STOCK_IN' ||
      l.status === 'READY_IN_MEAT_STATION') &&
      l.status !== 'VOID' &&
      l.status !== 'CANCELLED'
  )
  const inTransitLots = filteredDoughLots.filter(
    (l) => l.status === 'IN_TRANSIT_TO_ASSEMBLY'
  )
  const finishedLots = filteredDoughLots.filter(
    (l) =>
      l.status === 'IN_ASSEMBLY_STATION' ||
      l.status === 'CONSUMED' ||
      l.status === 'CLOSED'
  )

  // Bumbu di Ruangan Giling & Mixing (hanya yang sudah diterima di ruangan atau terpakai)
  const relevantBumbuLots = filteredSeasoningLots.filter(
    (b) =>
      b.status === 'IN_MEAT_MIXING_STATION' ||
      b.status === 'READY_IN_MEAT_MIXING_STATION' ||
      b.status === 'CONSUMED'
  )

  const availableBumbuSacks = relevantBumbuLots.filter(
    (b) => b.status !== 'CONSUMED' && (b.quantity === undefined || Number(b.quantity) > 0)
  )

  // Perhitungan Metrik Bumbu (Satuan Karung & Rincian Kresek)
  const totalBumbuAdaSacks = relevantBumbuLots.length
  const totalBumbuAdaKresek = relevantBumbuLots.reduce(
    (sum, b) => sum + (Number(b.initialQuantity) || 20),
    0
  )

  const deductedKresekFromLots = relevantBumbuLots.reduce((sum, b) => {
    const initial = Number(b.initialQuantity) || 20
    const remaining = b.status === 'CONSUMED' ? 0 : (b.quantity !== undefined ? Number(b.quantity) : initial)
    return sum + Math.max(0, initial - remaining)
  }, 0)

  const doughGilinganCount = filteredDoughLots.length
  const totalBumbuDigunakanKresek = totalBumbuAdaKresek > 0
    ? Math.min(totalBumbuAdaKresek, Math.max(deductedKresekFromLots, doughGilinganCount))
    : 0

  const totalBumbuSisaKresek = Math.max(0, totalBumbuAdaKresek - totalBumbuDigunakanKresek)
  const totalBumbuSisaSacks = availableBumbuSacks.length
  const transitBumbu = filteredSeasoningLots.filter((b) => b.status === 'IN_TRANSIT_TO_MEAT_MIXING')

  // Adonan di Ruangan sesuai Mode Scan
  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)
  const { mode: scanMode, pendingConfirmation: pendingDough, onHandStock: readyDoughLots } = groupStationLots(
    filteredDoughLots,
    'MEAT_STATION',
    scanModeSettings
  )
  const readyDough = readyDoughLots

  // Lot adonan yang memenuhi syarat untuk di-scan out
  const eligibleDoughLots = readyLots.filter(
    (l) =>
      l.status === 'READY_IN_MEAT_MIXING_STATION' ||
      l.status === 'READY_IN_MEAT_STATION' ||
      (scanMode === '1X' && l.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleDoughLots.map((l) => l.lotCode))

  // Inisialisasi multi-select hanya pada lot yang memenuhi syarat scan out
  const doughSelect = useLotMultiSelect(eligibleDoughLots)

  const handleSendSelectedDough = async () => {
    if (isSendingDough || doughSelect.selectedCount === 0) return
    setIsSendingDough(true)
    try {
      const selectedCodes = Array.from(doughSelect.selectedCodes)
      await scanOutAllDough(selectedCodes)
      doughSelect.clearSelection()
    } finally {
      setIsSendingDough(false)
    }
  }

  const handleVoidSingleLot = async (lotCode) => {
    if (!window.confirm(`Batalkan label ${lotCode}? Label ini akan ditandai BATAL (sisa rencana yang tidak terealisasi).`)) {
      return
    }
    await voidLots([lotCode])
  }

  const handleVoidSelectedLots = async () => {
    const selectedCodes = Array.from(doughSelect.selectedCodes)
    if (selectedCodes.length === 0) return
    if (!window.confirm(`Batalkan ${selectedCodes.length} label terpilih? Label ini akan ditandai BATAL (sisa rencana yang tidak terealisasi).`)) {
      return
    }
    const ok = await voidLots(selectedCodes)
    if (ok) {
      doughSelect.clearSelection()
    }
  }

  const handleReceiveAllBumbu = async () => {
    if (isReceivingBumbu || transitBumbu.length === 0) return
    setIsReceivingBumbu(true)
    try {
      await scanInSeasoningBatch()
    } finally {
      setIsReceivingBumbu(false)
    }
  }

  const handleReceiveSingleBumbu = async (lotCode) => {
    if (isReceivingBumbu) return
    setIsReceivingBumbu(true)
    try {
      await scanInSeasoningBatch([lotCode])
    } finally {
      setIsReceivingBumbu(false)
    }
  }

  // Buka Modal 3-Metrik Bumbu
  const handleOpenBumbuModal = (bumbuLot) => {
    setBumbuModalLot(bumbuLot)
    const currentQ = (bumbuLot.unit === 'KARUNG' && Number(bumbuLot.quantity) === 1) ? 20 : (Number(bumbuLot.quantity) || 20)
    setBumbuQtySent(currentQ.toString())
    setBumbuQtyUsed('1')
    setBumbuRemainingAction('STORE_IN_ROOM')
    setBumbuNotes('')
  }

  const handleSubmitBumbuUsage = async () => {
    if (!bumbuModalLot) return
    const sent = Number(bumbuQtySent) || 0
    const used = Number(bumbuQtyUsed) || 0
    if (used < 0 || used > sent) {
      alert('Jumlah digunakan tidak valid (tidak boleh melebihi jumlah tersedia).')
      return
    }

    setIsSavingBumbu(true)
    try {
      const ok = await recordMaterialUsage({
        lotCode: bumbuModalLot.lotCode,
        quantitySent: sent,
        quantityUsed: used,
        remainingAction: bumbuRemainingAction,
        notes: bumbuNotes.trim()
      })
      if (ok) {
        setBumbuModalLot(null)
      }
    } finally {
      setIsSavingBumbu(false)
    }
  }

  const handleExportExcel = () => {
    exportStationLotsExcel({
      stationName: 'Divisi Daging & Mixing',
      divisionCode: 'DAGING',
      dateStr: new Date().toISOString().slice(0, 10),
      lots: activeMeatTab === 'BUMBU' ? filteredSeasoningLots : filteredDoughLots,
      operatorName: operatorName || operatorId || 'Operator Daging'
    })
  }

  return (
    <div className="space-y-3.5 pb-36">
      {/* 1. Target Harian Stasiun (Ringkas 1 Baris Progres) */}
      <StationTargetBanner type="MEAT" />

      {/* 2. Tombol Scan In / Scan Out Terpadu (di atas toggle, selalu terlihat di semua tab) */}
      <ScanActionBar
        stationId="MEAT_STATION"
        stationName="Daging & Mixing"
        targetName="Meja Cetak"
        scanMode={scanMode}
        readyCount={readyDough.length}
        pendingCount={pendingDough.length}
        inTransitCount={transitBumbu.length + incomingMeatTransit.length}
        scanInSubtext={
          (transitBumbu.length + incomingMeatTransit.length) > 0
            ? `${transitBumbu.length + incomingMeatTransit.length} kiriman masuk`
            : (scanMode === '2X' && pendingDough.length > 0 ? `${pendingDough.length} perlu scan in` : null)
        }
      />

      {/* 3. Tombol Filter/Tab: Adonan & Bumbu (Gaya Chip seperti di Meja Cetak) + Unduh Excel */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-2">
          {[
            { id: 'GILING', label: 'Adonan' },
            { id: 'BUMBU', label: 'Bumbu' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMeatTab(tab.id)}
              className={`px-4 py-2 text-xs rounded-xl border font-bold transition-all cursor-pointer active:scale-95 ${
                activeMeatTab === tab.id
                  ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                  : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canExport && (
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-[#F5F1EB] active:bg-[#EDE8DF] border border-[#3A6B80] text-[#3A6B80] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            title="Unduh laporan data lot ke format Excel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Unduh Excel</span>
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ADONAN (PROSES & HASIL GILINGAN ADONAN)                      */}
      {/* =================================================================== */}
      {activeMeatTab === 'GILING' && (
        <div className="space-y-3.5">
          {/* Banner Peringatan Jika Ada Daging Mentah Dalam Pengiriman */}
          {incomingMeatTransit.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-2 border-b border-[#F3E5C1] pb-2">
                <div>
                  <span className="text-xs font-bold text-[#A8862E] block">
                    Ada {incomingMeatTransit.length} kiriman daging mentah dalam pengiriman
                  </span>
                </div>
              </div>

              {/* Daftar Daging yang Sedang Dalam Pengiriman */}
              <div className="space-y-1.5">
                {incomingMeatTransit.map((m) => (
                  <div
                    key={m.lotCode}
                    className="bg-white border border-[#F3E5C1] rounded-xl p-3 flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-mono font-bold text-[#2C3E50] text-sm block">
                        {m.lotCode}
                      </span>
                      <span className="text-[11px] text-[#6B7B8D] block">
                        Daging Mentah · {m.weightKg || 15} kg
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openCameraScanner({
                          mode: 'UNIVERSAL',
                          title: `Scan In ${m.lotCode}`
                        })
                      }
                      className="h-8 px-3 rounded-xl bg-[#d4a340] hover:bg-[#c29334] active:bg-[#b08328] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                      title={`Scan in lot ${m.lotCode}`}
                    >
                      <ScanIcon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                      <span>Scan in</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card Daftar Adonan */}
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
                <span className="text-xs font-bold text-[#2C3E50] block">
                  Daftar adonan
                </span>

                {filteredDoughLots.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      doughSelect.isSelecting
                        ? doughSelect.clearSelection()
                        : doughSelect.startSelecting()
                    }
                    className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-colors duration-150 cursor-pointer active:scale-[0.98] ${
                      doughSelect.isSelecting
                        ? 'bg-[#4685ac] text-white border-[#4685ac]'
                        : 'bg-white text-[#2C3E50] border-[#B7C3CE] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {doughSelect.isSelecting ? 'Selesai' : 'Pilih'}
                  </button>
                )}
              </div>

              {/* List Gilingan Aktif (Siap Troli & Di Meja Cetak) */}
              {readyLots.length === 0 && inTransitLots.length === 0 && finishedLots.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#6B7B8D] bg-[#F5F1EB] rounded-xl border border-[#EDE8DF]">
                  Belum ada gilingan yang terdaftar hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada lot yang memenuhi syarat) */}
                  {doughSelect.isSelecting && eligibleDoughLots.length > 0 && (
                    <div
                      onClick={() =>
                        doughSelect.isAllSelected
                          ? doughSelect.clearSelection()
                          : doughSelect.selectAll()
                      }
                      className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={doughSelect.isAllSelected}
                          onChange={() =>
                            doughSelect.isAllSelected
                              ? doughSelect.clearSelection()
                              : doughSelect.selectAll()
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer shrink-0"
                        />
                        <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                      </div>
                      <Badge
                        variant={doughSelect.selectedCount > 0 ? 'info' : 'neutral'}
                        size="sm"
                        tabular
                      >
                        {doughSelect.selectedCount === 0
                          ? `${eligibleDoughLots.length} siap`
                          : doughSelect.selectedCount === eligibleDoughLots.length
                          ? `Semua dipilih (${eligibleDoughLots.length})`
                          : `${doughSelect.selectedCount} dari ${eligibleDoughLots.length} dipilih`}
                      </Badge>
                    </div>
                  )}

                  {readyLots.map((lot) => (
                    <DoughLotCard
                      key={lot.lotCode}
                      lot={lot}
                      scanMode={scanMode}
                      isSelected={doughSelect.selectedCodes.has(lot.lotCode)}
                      isSelecting={doughSelect.isSelecting}
                      isEligible={eligibleCodesSet.has(lot.lotCode)}
                      onToggle={() => doughSelect.toggleSelect(lot.lotCode)}
                      onStartSelecting={() => doughSelect.startSelecting()}
                      canOpenQr={canOpenQr(userRole)}
                      onPrint={() =>
                        setPrintModal({
                          lotCode: lot.lotCode,
                          title: 'ADONAN GILINGAN',
                          detail: 'Troli Gilingan & Mixing',
                          weight: '1 gilingan',
                          createdAt: lot.createdAt
                        })
                      }
                      onVoid={isPIC ? () => handleVoidSingleLot(lot.lotCode) : undefined}
                    />
                  ))}

                  {inTransitLots.map((lot) => (
                    <DoughLotCard
                      key={lot.lotCode}
                      lot={lot}
                      scanMode={scanMode}
                      isSelected={false}
                      isSelecting={doughSelect.isSelecting}
                      isEligible={false}
                      onToggle={() => {}}
                      onStartSelecting={() => {}}
                      canOpenQr={canOpenQr(userRole)}
                      onPrint={() =>
                        setPrintModal({
                          lotCode: lot.lotCode,
                          title: 'ADONAN GILINGAN',
                          detail: 'Troli Gilingan & Mixing',
                          weight: '1 gilingan',
                          createdAt: lot.createdAt
                        })
                      }
                    />
                  ))}

                  {readyLots.length === 0 && inTransitLots.length === 0 && finishedLots.length > 0 && (
                    <div className="py-3 px-3 text-center text-xs text-[#6B7B8D] bg-[#F5F1EB] rounded-xl border border-[#EDE8DF]">
                      Semua gilingan hari ini telah selesai dicetak.
                    </div>
                  )}
                </div>
              )}

              {/* Baris Lipatan Gilingan Selesai (Terpakai Cetak) */}
              {finishedLots.length > 0 && (
                <div className="border border-[#EDE8DF] rounded-xl overflow-hidden bg-white shadow-2xs pt-1">
                  <button
                    type="button"
                    onClick={() => setIsFinishedFolded((prev) => !prev)}
                    className="w-full px-3.5 py-3 bg-[#F5F1EB] hover:bg-[#EDE8DF] flex items-center justify-between text-xs transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#2C3E50]">
                        Selesai cetak ({finishedLots.length})
                      </span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        · Telah menjadi dimsum
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#6B7B8D]">
                      <span>{isFinishedFolded ? 'Buka' : 'Tutup'}</span>
                      <ChevronDownIcon
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isFinishedFolded ? '' : 'rotate-180'
                        }`}
                      />
                    </div>
                  </button>

                  {!isFinishedFolded && (
                    <div className="p-3 space-y-2 border-t border-[#EDE8DF] bg-[#FAF8F5]">
                      {finishedLots.map((lot) => (
                        <div
                          key={lot.lotCode}
                          className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 flex items-center justify-between text-xs gap-2 shadow-2xs"
                        >
                          <div>
                            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                              {lot.lotCode}
                            </span>
                            <span className="text-[10px] text-[#6B7B8D] tabular-nums">
                              {lot.createdAt || '--:--'}
                            </span>
                          </div>

                          <Badge variant="success" size="sm">
                            Terpakai cetak
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BUMBU (STOK & PEMAKAIAN KARUNG BUMBU)                       */}
      {/* =================================================================== */}
      {activeMeatTab === 'BUMBU' && (
        <div className="space-y-3.5">
          {/* Banner Peringatan Jika Ada Kiriman Masuk */}
          {transitBumbu.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
              <div className="border-b border-[#F3E5C1] pb-2">
                <span className="text-xs font-bold text-[#A8862E] block">
                  Ada {transitBumbu.length} karung bumbu dalam pengiriman
                </span>
              </div>

              {/* Daftar Karung Bumbu yang Sedang Dalam Pengiriman */}
              <div className="space-y-1.5">
                {transitBumbu.map((b) => {
                  const qtyKresek = (b.unit === 'KARUNG' && Number(b.quantity) === 1) ? 20 : (Number(b.quantity) || 20)
                  return (
                    <div
                      key={b.lotCode}
                      className="bg-white border border-[#F3E5C1] rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#2C3E50] text-sm block">{b.lotCode}</span>
                          <span className="px-1.5 py-0.5 bg-[#F3E5C1] text-[#A8862E] text-[10px] font-bold rounded">1 Karung</span>
                        </div>
                        <span className="text-[11px] text-[#6B7B8D] block">
                          Isi: {qtyKresek} kresek bumbu racik
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canOpenQr(userRole, currentUser) && (
                          <button
                            type="button"
                            onClick={() =>
                              setPrintModal({
                                lotCode: b.lotCode,
                                title: 'KARUNG BUMBU RACIK',
                                detail: 'Kiriman Bumbu ke Gilingan',
                                weight: '1 Karung (@ 20 kresek)',
                                createdAt: b.createdAt
                              })
                            }
                            className="w-8 h-8 rounded-lg border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] cursor-pointer shadow-2xs active:scale-95 transition-all"
                            title="Lihat QR"
                            aria-label="Lihat QR"
                          >
                            <PrinterIcon className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            openCameraScanner({
                              mode: 'UNIVERSAL',
                              title: `Scan In ${b.lotCode}`
                            })
                          }
                          className="h-8 px-3 rounded-xl bg-[#d4a340] hover:bg-[#c29334] active:bg-[#b08328] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                          title={`Scan in karung ${b.lotCode}`}
                        >
                          <ScanIcon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                          <span>Scan in</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tombol Aksi Penerimaan Bumbu:
                  - PIC: Tombol "Terima langsung" selebar kartu (penerimaan massal tanpa scan)
                  - Karyawan / Scan In: Menggunakan tombol Scan In di bar atas stasiun */}
              {isPIC && (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    className="min-h-[48px] bg-white border-[#B7C3CE] text-[#2C3E50] hover:bg-[#F5F1EB]"
                    loading={isReceivingBumbu}
                    disabled={isReceivingBumbu}
                    onClick={handleReceiveAllBumbu}
                  >
                    Terima langsung
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Kartu Terpadu: Stok & Pemakaian Bumbu */}
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 space-y-3.5">
              <div className="border-b border-[#EDE8DF] pb-2.5">
                <span className="text-xs font-bold text-[#2C3E50] block">
                  Stok bumbu di ruangan
                </span>
              </div>

              {/* Komponen Detail 3-Metrik Bumbu: Ada, Digunakan, Sisa */}
              <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[11px] text-[#6B7B8D] block font-medium">Ada</span>
                  <span className="text-base sm:text-lg font-bold text-[#2C3E50] tabular-nums block my-0.5">
                    {totalBumbuAdaSacks} <span className="text-xs font-semibold text-[#6B7B8D]">krg</span>
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">{totalBumbuAdaKresek} kresek</span>
                </div>

                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[11px] text-[#A8862E] block font-medium">Digunakan</span>
                  <span className="text-base sm:text-lg font-bold text-[#A8862E] tabular-nums block my-0.5">
                    {totalBumbuDigunakanKresek} <span className="text-xs font-semibold text-[#A8862E]">krsk</span>
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">
                    {totalBumbuDigunakanKresek > 0 ? `${(totalBumbuDigunakanKresek / 20).toFixed(1)} krg` : '0 krg'}
                  </span>
                </div>

                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className={`text-[11px] block font-medium ${totalBumbuSisaKresek > 0 ? 'text-[#2F7D5B]' : 'text-[#6B7B8D]'}`}>
                    Sisa
                  </span>
                  <span className={`text-base sm:text-lg font-bold tabular-nums block my-0.5 ${totalBumbuSisaKresek > 0 ? 'text-[#2F7D5B]' : 'text-[#6B7B8D]'}`}>
                    {totalBumbuSisaSacks} <span className="text-xs font-semibold">krg</span>
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">{totalBumbuSisaKresek} kresek</span>
                </div>
              </div>

              {/* Daftar Lot Bumbu Aktif */}
              {availableBumbuSacks.length === 0 ? (
                <div className="py-4 px-3 text-center bg-[#F5F1EB] rounded-xl border border-[#EDE8DF] text-[#6B7B8D] text-xs space-y-2">
                  <p className="font-semibold text-[#2C3E50]">Belum ada bumbu aktif di ruangan.</p>
                  {transitBumbu.length === 0 && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={ScanIcon}
                        onClick={() =>
                          openCameraScanner({
                            mode: 'UNIVERSAL',
                            title: 'Scan In Karung Bumbu'
                          })
                        }
                      >
                        Scan in karung bumbu
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D]">
                      Karung bumbu tersedia
                    </span>
                    <span className="text-[11px] text-[#6B7B8D]">
                      Klik Gunakan untuk catat porsi
                    </span>
                  </div>

                  {availableBumbuSacks.map((bumbu) => {
                    const currentQ = (bumbu.unit === 'KARUNG' && Number(bumbu.quantity) === 1) ? 20 : (Number(bumbu.quantity) || 20)
                    const isFull = currentQ >= 20
                    return (
                      <div
                        key={bumbu.lotCode}
                        className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                              {bumbu.lotCode}
                            </span>
                            <Badge variant={isFull ? 'success' : 'warning'} size="sm">
                              {isFull ? '1 Karung Utuh' : 'Terpakai Sebagian'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-[#6B7B8D] mt-0.5 block">
                            Tersedia: <strong className="text-[#2C3E50] tabular-nums font-bold">{currentQ}</strong> / 20 kresek
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenBumbuModal({ ...bumbu, quantity: currentQ })}
                        >
                          Gunakan
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Modal Pemakaian Bumbu */}
      <Modal
        isOpen={Boolean(bumbuModalLot)}
        onClose={() => setBumbuModalLot(null)}
        title="Catat pemakaian bumbu"
        subtitle={bumbuModalLot ? `${bumbuModalLot.lotCode} · 1 Karung Sak (@ 20 kresek)` : ''}
        size="sm"
      >
        {bumbuModalLot && (
          <div className="space-y-4">
            {/* Ringkasan Ringkas 1 Baris: Tersedia di Karung & Sisa */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
                <span className="text-[11px] text-[#6B7B8D] font-medium block">Tersedia di Karung</span>
                <span className="font-bold text-[#2C3E50] text-xl tabular-nums block my-0.5">{bumbuQtySent}</span>
                <span className="text-[10px] text-[#6B7B8D] block">kresek</span>
              </div>

              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
                <span className="text-[11px] text-[#6B7B8D] font-medium block">Sisa di Karung</span>
                <span className="font-bold text-[#2C3E50] text-xl tabular-nums block my-0.5">
                  {Math.max(0, (Number(bumbuQtySent) || 0) - (Number(bumbuQtyUsed) || 0))}
                </span>
                <span className="text-[10px] text-[#6B7B8D] block">kresek</span>
              </div>
            </div>

            {/* Stepper Jumlah Digunakan 48px */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[#2C3E50]">
                  Jumlah kresek digunakan
                </label>
                <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                  Maks {bumbuQtySent} kresek
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={(Number(bumbuQtyUsed) || 0) <= 0}
                  onClick={() => setBumbuQtyUsed((val) => Math.max(0, (Number(val) || 0) - 1).toString())}
                  className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0 active:scale-[0.98]"
                >
                  <MinusIcon className="w-5 h-5" />
                </button>

                <input
                  type="number"
                  min="0"
                  max={bumbuQtySent}
                  value={bumbuQtyUsed}
                  onChange={(e) => {
                    const maxVal = Number(bumbuQtySent) || 0
                    const raw = e.target.value
                    if (raw === '') {
                      setBumbuQtyUsed('')
                      return
                    }
                    const parsed = Math.max(0, parseInt(raw, 10) || 0)
                    setBumbuQtyUsed(Math.min(maxVal, parsed).toString())
                  }}
                  className="flex-1 h-12 text-center tabular-nums font-bold text-[#2C3E50] text-lg bg-white border-[1.5px] border-[#B7C3CE] rounded-xl focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 shadow-2xs"
                  placeholder="0"
                />

                <button
                  type="button"
                  disabled={(Number(bumbuQtyUsed) || 0) >= (Number(bumbuQtySent) || 0)}
                  onClick={() => {
                    const maxVal = Number(bumbuQtySent) || 0
                    setBumbuQtyUsed((val) => Math.min(maxVal, (Number(val) || 0) + 1).toString())
                  }}
                  className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0 active:scale-[0.98]"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[11px] text-[#6B7B8D] mt-1">
                1 gilingan adonan membutuhkan 1 kresek bumbu Sparta. Sisa kresek tetap tersimpan di dalam karung ini.
              </p>
            </div>

            {/* Kolom Catatan */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7B8D] block">
                Catatan (opsional)
              </span>
              <input
                type="text"
                value={bumbuNotes}
                onChange={(e) => setBumbuNotes(e.target.value)}
                placeholder="Catatan jika ada deviasi..."
                className="w-full h-11 px-3.5 text-xs border border-[#EDE8DF] rounded-xl bg-white text-[#2C3E50] placeholder-[#6B7B8D] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 shadow-2xs"
              />
            </div>

            {/* Tombol Simpan Modal */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setBumbuModalLot(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={isSavingBumbu}
                disabled={isSavingBumbu}
                onClick={handleSubmitBumbuUsage}
              >
                Simpan pemakaian
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Floating Action Bar untuk Adonan Terpilih (Hanya muncul jika N > 0) */}
      <BatchPrintSelectionBar
        selectedCount={doughSelect.selectedCount}
        canOpenQr={canOpenQr(userRole, currentUser)}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: 'Scan Out Adonan ke Meja Cetak'
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={isPIC ? handleSendSelectedDough : undefined}
        manualDispatchLabel="Kirim"
        actionLabel={isPIC ? 'Batalkan sisa' : undefined}
        onAction={isPIC ? handleVoidSelectedLots : undefined}
        onPrint={() => openBatchPrintModal(doughSelect.selectedLots, 'ADONAN GILINGAN SIAP CETAK')}
      />
    </div>
  )
}

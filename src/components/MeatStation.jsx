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
import { Stepper } from './ui/Stepper'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { groupStationLots } from '../utils/scanMode'
import { canOpenQr, canManualDispatch } from '../utils/permissions'

function DoughLotCard({
  lot,
  badgeVariant,
  badgeText,
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
        <Badge variant={badgeVariant} size="sm">
          {badgeText}
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

  const [gilinganInput, setGilinganInput] = useState(1)
  const [batchNotes, setBatchNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
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
  const isPIC = canManualDispatch(userRole, currentUser)

  const seasoningLots = useProduction1Store((s) => s.seasoningLots)
  const doughLots = useProduction1Store((s) => s.doughLots)

  const produceBatchUnified = useProduction1Store((s) => s.produceBatchUnified)
  const recordMaterialUsage = useProduction1Store((s) => s.recordMaterialUsage)
  const scanInSeasoningBatch = useProduction1Store((s) => s.scanInSeasoningBatch)
  const scanOutAllDough = useProduction1Store((s) => s.scanOutAllDough)
  const voidLots = useProduction1Store((s) => s.voidLots)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)

  const filteredDoughLots = filterAndSortLots(doughLots, 'TODAY', 'OPERATOR')
  const filteredSeasoningLots = filterAndSortLots(seasoningLots, 'TODAY', 'OPERATOR')

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

  // Perhitungan 3-Metrik Bumbu: Ada, Digunakan, Sisa
  const totalBumbuAda = relevantBumbuLots.reduce(
    (sum, b) => sum + (Number(b.initialQuantity) || 20),
    0
  )

  const deductedFromLots = relevantBumbuLots.reduce((sum, b) => {
    const initial = Number(b.initialQuantity) || 20
    const remaining = b.status === 'CONSUMED' ? 0 : (b.quantity !== undefined ? Number(b.quantity) : initial)
    return sum + Math.max(0, initial - remaining)
  }, 0)

  const doughGilinganCount = filteredDoughLots.length
  const totalBumbuDigunakan = totalBumbuAda > 0
    ? Math.min(totalBumbuAda, Math.max(deductedFromLots, doughGilinganCount))
    : 0

  const totalBumbuSisa = Math.max(0, totalBumbuAda - totalBumbuDigunakan)
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

  // Handlers Eksekusi Giling & Mixing Terpadu
  const handleExecuteBatchUnified = async () => {
    const count = parseInt(gilinganInput, 10) || 1
    if (count <= 0 || isProcessing) return
    setIsProcessing(true)
    try {
      const yieldNum = 20.00
      await produceBatchUnified({
        gilinganCount: count,
        doughYieldKg: yieldNum,
        bumbuLotCodes: [],
        notes: batchNotes.trim()
      })
      setBatchNotes('')
    } finally {
      setIsProcessing(false)
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
    const currentQ = Number(bumbuLot.quantity) || 20
    setBumbuQtySent(currentQ.toString())
    setBumbuQtyUsed(Math.min(currentQ, gilinganInput).toString())
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

  return (
    <div className="space-y-3.5 pb-36">
      {/* 1. Target Harian Stasiun (Ringkas 1 Baris Progres) */}
      <StationTargetBanner type="MEAT" />

      {/* 2. Tombol Filter/Tab: Adonan & Bumbu (Gaya Chip seperti di Meja Cetak) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
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

      {/* =================================================================== */}
      {/* TAB 1: ADONAN (PROSES & HASIL GILINGAN ADONAN)                      */}
      {/* =================================================================== */}
      {activeMeatTab === 'GILING' && (
        <div className="space-y-3.5">
          {/* Tombol Aksi Utama: Scan Out Adonan ke Meja Cetak (Hanya tampil di luar mode pilih) */}
          {!doughSelect.isSelecting && readyDough.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() =>
                openCameraScanner({
                  mode: 'UNIVERSAL',
                  title: 'Scan Out Adonan ke Meja Cetak'
                })
              }
              icon={ScanIcon}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Scan out ke cetak</span>
                <Badge variant="neutral" size="sm" className="bg-white/20 text-white border-transparent">
                  {readyDough.length} siap
                </Badge>
              </div>
            </Button>
          )}

          {/* Section Menunggu Konfirmasi jika Mode 2x aktif */}
          {scanMode === '2X' && pendingDough.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-[#F3E5C1] pb-2">
                <span className="text-xs font-bold text-[#A8862E]">
                  Menunggu Konfirmasi Stok ({pendingDough.length} gilingan)
                </span>
                <Badge variant="warning" size="sm">
                  Perlu Scan Masuk
                </Badge>
              </div>
              <div className="space-y-1.5">
                {pendingDough.map((lot) => (
                  <div
                    key={lot.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{lot.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        Adonan
                      </span>
                    </div>
                    <Badge variant="warning" size="sm">
                      Belum di-scan
                    </Badge>
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
                      badgeVariant="warning"
                      badgeText="Label Disiapkan PIC"
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
                      badgeVariant="info"
                      badgeText="Di meja cetak"
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

          {/* Panel PIC: Penerbitan Batch Label Baru (Khusus PIC / Supervisor) */}
          {isPIC && (
            <Card variant="action" className="border-[#D1E4EF] bg-white">
              <CardContent className="p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-[#2C3E50] block">
                      Penerbitan label batch baru
                    </span>
                    <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                      Khusus PIC · Cetak lembar rekap QR troli adonan
                    </span>
                  </div>
                  {lastBatchPrintModal?.lotList?.length > 0 && (
                    <button
                      type="button"
                      onClick={reopenLastBatchPrintModal}
                      className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2.5 py-1 cursor-pointer transition-all active:scale-95"
                      title="Buka kembali lembar rekap QR troli terakhir"
                    >
                      Rekap ({lastBatchPrintModal.lotList.length})
                    </button>
                  )}
                </div>

                {/* Stepper Jumlah Gilingan dengan Baris Konversi */}
                <Stepper
                  label="Jumlah gilingan"
                  value={gilinganInput}
                  onChange={(val) => setGilinganInput(val)}
                  min={1}
                  max={100}
                  presets={[1, 2, 5, 10]}
                  conversionText={`= ${gilinganInput * 15} kg daging`}
                />

                {/* Catatan Operasional Batch */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#6B7B8D] block">
                    Catatan (opsional)
                  </label>
                  <input
                    type="text"
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="Tambahkan catatan jika ada..."
                    className="w-full h-11 text-xs border border-[#EDE8DF] rounded-xl px-3.5 bg-white text-[#2C3E50] placeholder-[#6B7B8D] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 transition-colors shadow-2xs"
                  />
                </div>

                {/* Tombol Aksi Utama 56px */}
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isProcessing}
                  disabled={isProcessing}
                  onClick={handleExecuteBatchUnified}
                  icon={PrinterIcon}
                >
                  Proses & cetak rekap
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BUMBU (STOK & PEMAKAIAN KARUNG BUMBU)                       */}
      {/* =================================================================== */}
      {activeMeatTab === 'BUMBU' && (
        <div className="space-y-3.5">
          {/* Banner Peringatan Jika Ada Kiriman Masuk */}
          {transitBumbu.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-2 border-b border-[#F3E5C1] pb-2">
                <div>
                  <span className="text-xs font-bold text-[#A8862E] block">
                    Ada {transitBumbu.length} karung bumbu dalam pengiriman
                  </span>
                  <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                    {isPIC
                      ? 'Pindai barcode untuk verifikasi, atau gunakan terima langsung.'
                      : 'Pindai barcode pada karung bumbu untuk menerima kiriman.'}
                  </span>
                </div>
                <Badge variant="warning" size="sm">
                  Perlu scan masuk
                </Badge>
              </div>

              {/* Daftar Karung Bumbu yang Sedang Dalam Pengiriman */}
              <div className="space-y-1.5">
                {transitBumbu.map((b) => (
                  <div
                    key={b.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs gap-2"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{b.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        Karung bumbu racik · {b.quantity || 20} kresek
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {canOpenQr(userRole, currentUser) && (
                        <button
                          type="button"
                          onClick={() =>
                            setPrintModal({
                              lotCode: b.lotCode,
                              title: 'KARUNG BUMBU RACIK',
                              detail: 'Kiriman Bumbu ke Gilingan',
                              weight: `${b.quantity || 20} kresek`,
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

                      {isPIC ? (
                        <button
                          type="button"
                          disabled={isReceivingBumbu}
                          onClick={() => handleReceiveSingleBumbu(b.lotCode)}
                          className="h-8 px-2.5 text-xs text-[#4685ac] hover:text-[#3A6B80] underline cursor-pointer font-semibold disabled:opacity-50"
                          title="Terima karung ini secara manual"
                        >
                          Terima
                        </button>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Belum di-scan
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tombol Aksi Penerimaan:
                  - Karyawan: Hanya 1 tombol "Scan in"
                  - MODE PPIC / PIC: 2 tombol ("Terima langsung" & "Scan in") */}
              {isPIC ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1 min-h-[48px] bg-white border-[#B7C3CE] text-[#2C3E50] hover:bg-[#F5F1EB]"
                    loading={isReceivingBumbu}
                    disabled={isReceivingBumbu}
                    onClick={handleReceiveAllBumbu}
                  >
                    Terima langsung
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="flex-1 min-h-[48px]"
                    icon={ScanIcon}
                    onClick={() =>
                      openCameraScanner({
                        mode: 'UNIVERSAL',
                        title: `Scan In ${transitBumbu.length} Karung Bumbu`
                      })
                    }
                  >
                    Scan in
                  </Button>
                </div>
              ) : (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="min-h-[48px]"
                    icon={ScanIcon}
                    onClick={() =>
                      openCameraScanner({
                        mode: 'UNIVERSAL',
                        title: `Scan In ${transitBumbu.length} Karung Bumbu`
                      })
                    }
                  >
                    Scan in ({transitBumbu.length})
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
                <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                  Standar @ 20 kresek per karung
                </span>
              </div>

              {/* Komponen Detail 3-Metrik Bumbu: Ada, Digunakan, Sisa */}
              <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[11px] text-[#6B7B8D] block font-medium">Ada</span>
                  <span className="text-base sm:text-lg font-bold text-[#2C3E50] tabular-nums block my-0.5">
                    {totalBumbuAda}
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">kresek</span>
                </div>

                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[11px] text-[#A8862E] block font-medium">Digunakan</span>
                  <span className="text-base sm:text-lg font-bold text-[#A8862E] tabular-nums block my-0.5">
                    {totalBumbuDigunakan}
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">kresek</span>
                </div>

                <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                  <span className={`text-[11px] block font-medium ${totalBumbuSisa > 0 ? 'text-[#2F7D5B]' : 'text-[#6B7B8D]'}`}>
                    Sisa
                  </span>
                  <span className={`text-base sm:text-lg font-bold tabular-nums block my-0.5 ${totalBumbuSisa > 0 ? 'text-[#2F7D5B]' : 'text-[#6B7B8D]'}`}>
                    {totalBumbuSisa}
                  </span>
                  <span className="text-[10px] text-[#6B7B8D] block font-sans">kresek</span>
                </div>
              </div>

              {/* Daftar Lot Bumbu Aktif */}
              {availableBumbuSacks.length === 0 ? (
                <div className="py-4 px-3 text-center bg-[#F5F1EB] rounded-xl border border-[#EDE8DF] text-[#6B7B8D] text-xs space-y-2">
                  <p className="font-semibold text-[#2C3E50]">Belum ada bumbu aktif di ruangan.</p>
                  <p className="text-[11px]">
                    Scan barcode karung bumbu untuk menerima kiriman dari bumbu.
                  </p>
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
                    const currentQ = Number(bumbu.quantity) || 20
                    return (
                      <div
                        key={bumbu.lotCode}
                        className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                      >
                        <div>
                          <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
                            {bumbu.lotCode}
                          </span>
                          <span className="text-[11px] text-[#6B7B8D]">
                            Tersedia: <strong className="text-[#2C3E50] tabular-nums font-bold">{currentQ}</strong> kresek
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenBumbuModal(bumbu)}
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
        subtitle={bumbuModalLot ? `${bumbuModalLot.lotCode} · Bumbu racik` : ''}
        size="sm"
      >
        {bumbuModalLot && (
          <div className="space-y-4">
            {/* Ringkasan Ringkas 1 Baris: Tersedia & Sisa */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
                <span className="text-[11px] text-[#6B7B8D] font-medium block">Tersedia</span>
                <span className="font-bold text-[#2C3E50] text-xl tabular-nums block my-0.5">{bumbuQtySent}</span>
                <span className="text-[10px] text-[#6B7B8D] block">kresek</span>
              </div>

              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
                <span className="text-[11px] text-[#6B7B8D] font-medium block">Sisa</span>
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
                  Jumlah digunakan (kresek)
                </label>
                <span className="text-[11px] text-[#6B7B8D] tabular-nums">
                  Maks {bumbuQtySent}
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
        canOpenQr={canOpenQr(userRole)}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: 'Scan Out Adonan ke Meja Cetak'
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={canManualDispatch(userRole) ? handleSendSelectedDough : undefined}
        manualDispatchLabel="Kirim"
        actionLabel={isPIC ? 'Batalkan sisa' : undefined}
        onAction={isPIC ? handleVoidSelectedLots : undefined}
        onPrint={() => openBatchPrintModal(doughSelect.selectedLots, 'ADONAN GILINGAN SIAP CETAK')}
      />
    </div>
  )
}

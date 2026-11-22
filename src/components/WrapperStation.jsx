import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots, groupLotsByDay } from '../utils/dateFilter'
import { PrinterIcon, ScanIcon, MinusIcon, PlusIcon, CameraIcon } from './Icons'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import { Card, CardContent } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Stepper } from './ui/Stepper'
import { Modal } from './ui/Modal'
import { groupStationLots, getLotSemanticBadge } from '../utils/scanMode'
import { canOpenQr, canManualDispatch, canExportExcel } from '../utils/permissions'
import { exportStationLotsExcel } from '../utils/excelExport'
import ScanActionBar from './ScanActionBar'

function WrapperLotCard({
  lot,
  sizeLabel,
  balCount,
  kgCount,
  isReady,
  scanMode = '1X',
  isSelected,
  isSelecting,
  isEligible = true,
  onToggle,
  onStartSelecting,
  canOpenQr: hasQrPermission = false,
  onPrint
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
      } else if (hasQrPermission) {
        onPrint()
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
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
              {lot.lotCode}
            </span>
            {(lot.sourceType === 'EXTERNAL' || Boolean(lot.supplierName)) && (
              <Badge variant="neutral" size="sm">
                Supplier
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-[#6B7B8D] tabular-nums block mt-0.5">
            {sizeLabel} · {balCount} bal ({kgCount} kg){lot.supplierName ? ` · ${lot.supplierName}` : ''}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        {(() => {
          const badge = getLotSemanticBadge(lot.status, scanMode)
          return (
            <Badge variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          )
        })()}

        {hasQrPermission && (
          <button
            type="button"
            onClick={onPrint}
            className="w-10 h-10 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] hover:text-[#2C3E50] transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Cetak Ulang Barcode"
            aria-label="Cetak ulang barcode"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function WrapperStation() {
  const [wrapperType, setWrapperType] = useState('KULIT_9CM')
  const [balQty, setBalQty] = useState('1')
  const [isSending, setIsSending] = useState(false)
  const [activeWrapperTab, setActiveWrapperTab] = useState('BAL') // 'BAL' | 'BAHAN'
  const [isScanningIn, setIsScanningIn] = useState(null)

  // State Modal 3-Metrik Pemakaian Bahan Baku
  const [rawModalLot, setRawModalLot] = useState(null)
  const [rawQtySent, setRawQtySent] = useState('0')
  const [rawQtyUsed, setRawQtyUsed] = useState('1')
  const [rawRemainingAction, setRawRemainingAction] = useState('STORE_IN_ROOM')
  const [rawNotes, setRawNotes] = useState('')
  const [isSavingRaw, setIsSavingRaw] = useState(false)

  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const isPIC = canManualDispatch(userRole, currentUser)
  const canExport = canExportExcel(userRole, currentUser)
  const wrapperLots = useProduction1Store((s) => s.wrapperLots)
  const createWrapperLot = useProduction1Store((s) => s.createWrapperLot)
  const scanOutWrapperLot = useProduction1Store((s) => s.scanOutWrapperLot)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const recordMaterialUsage = useProduction1Store((s) => s.recordMaterialUsage)
  const triggerScanTransition = useProduction1Store((s) => s.triggerScanTransition)
  const fetchInitialData = useProduction1Store((s) => s.fetchInitialData)

  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)

  const filteredWrapperLots = filterAndSortLots(wrapperLots, 'TODAY', 'OPERATOR')

  // Pisahkan Lot Bal Kulit Pangsit (Output) dan Lot Bahan Baku Inbound (Input)
  const rawMaterialLots = filteredWrapperLots.filter(
    (l) => l.isRawMaterial || (l.lotCode && l.lotCode.startsWith('OUT-'))
  )
  const outputBalLots = filteredWrapperLots.filter(
    (l) => !l.isRawMaterial && (!l.lotCode || !l.lotCode.startsWith('OUT-'))
  )

  // 1. Bahan Baku Inbound (Input: Tepung Hyari, Tapioka, Air Abu, Telur, Vanili, dll.)
  const incomingRawLots = rawMaterialLots.filter(
    (l) =>
      l.status === 'IN_TRANSIT_TO_WRAPPER' ||
      l.status === 'IN_TRANSIT_TO_WRAPPER_STATION' ||
      (l.status && l.status.startsWith('IN_TRANSIT_TO_'))
  )
  const availableRawMaterials = rawMaterialLots.filter(
    (l) =>
      (l.status === 'READY_IN_WRAPPER_STATION' || l.status === 'IN_WRAPPER_STATION') &&
      l.status !== 'CONSUMED' &&
      l.status !== 'VOID' &&
      Number(l.quantity) > 0
  )

  // 2. Bal Kulit Pangsit (Output: KL-...)
  const { mode: scanMode, pendingConfirmation, onHandStock } = groupStationLots(
    outputBalLots,
    'WRAPPER_STATION',
    scanModeSettings
  )
  const readyWrappers = onHandStock

  // Hanya lot bal kulit yang siap di stasiun kulit yang memenuhi syarat untuk di-scan out
  const eligibleWrapperLots = outputBalLots.filter(
    (w) =>
      w.status === 'READY_IN_WRAPPER_STATION' ||
      (scanMode === '1X' && w.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleWrapperLots.map((w) => w.lotCode))
  const wrapperSelect = useLotMultiSelect(eligibleWrapperLots)
  const transitLots = outputBalLots.filter((w) => w.status === 'IN_TRANSIT_TO_ASSEMBLY')

  const handleExportExcel = () => {
    exportStationLotsExcel({
      stationName: 'Divisi Kulit Pangsit',
      divisionCode: 'KULIT',
      dateStr: new Date().toISOString().slice(0, 10),
      lots: activeWrapperTab === 'BAHAN' ? rawMaterialLots : outputBalLots,
      operatorName: operatorName || operatorId || 'Operator Kulit'
    })
  }

  const handleSendSelected = async () => {
    if (isSending || wrapperSelect.selectedCount === 0) return
    setIsSending(true)
    try {
      for (const w of wrapperSelect.selectedLots) {
        await scanOutWrapperLot(w.lotCode)
      }
      wrapperSelect.clearSelection()
    } finally {
      setIsSending(false)
    }
  }

  const handleScanInMaterial = async (lotCode) => {
    if (isScanningIn) return
    setIsScanningIn(lotCode)
    try {
      const res = await triggerScanTransition(lotCode, 'WRAPPER_STATION', null, 'SCAN_IN')
      if (res?.success) {
        await fetchInitialData(true)
      }
    } finally {
      setIsScanningIn(null)
    }
  }

  const handleOpenRawModal = (item) => {
    setRawModalLot(item)
    const currentQ = Number(item.quantity) || 0
    setRawQtySent(currentQ.toString())
    setRawQtyUsed(Math.min(currentQ, 1).toString())
    setRawRemainingAction('STORE_IN_ROOM')
    setRawNotes('')
  }

  const handleSubmitRawUsage = async () => {
    if (!rawModalLot) return
    const sent = Number(rawQtySent) || 0
    const used = Number(rawQtyUsed) || 0
    if (used <= 0 || used > sent) {
      alert('Jumlah digunakan tidak valid (harus > 0 dan tidak boleh melebihi jumlah tersedia).')
      return
    }

    setIsSavingRaw(true)
    try {
      const ok = await recordMaterialUsage({
        lotCode: rawModalLot.lotCode,
        quantitySent: sent,
        quantityUsed: used,
        remainingAction: rawRemainingAction,
        notes: rawNotes.trim()
      })
      if (ok) {
        setRawModalLot(null)
      }
    } finally {
      setIsSavingRaw(false)
    }
  }

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Status Harian Bal Kulit Siap Kirim */}
      <div className="space-y-3">
        <Card className="border-[#EDE8DF] bg-white shadow-2xs min-h-[var(--size-hero-card,96px)] flex flex-col justify-center">
          <CardContent className="p-4 text-center space-y-1">
            <span className="text-xs text-[#6B7B8D] font-medium block">
              Kulit siap kirim ke meja cetak
            </span>
            <span className="text-3xl font-bold tabular-nums text-[#2C3E50] block">
              {readyWrappers.length} <span className="text-base font-normal text-[#6B7B8D]">bal</span>
            </span>
          </CardContent>
        </Card>

        {/* 2. Tombol Scan In dan Scan Out Terpadu (Selalu terlihat berdampingan seperti di Meja Giling & Mix) */}
        <ScanActionBar
          stationId="WRAPPER_STATION"
          stationName="Kulit Pangsit"
          targetName="Meja Cetak"
          scanMode={scanMode}
          readyCount={readyWrappers.length}
          pendingCount={pendingConfirmation.length}
          inTransitCount={incomingRawLots.length}
          scanInSubtext={
            incomingRawLots.length > 0
              ? `${incomingRawLots.length} kiriman masuk`
              : (scanMode === '2X' && pendingConfirmation.length > 0 ? `${pendingConfirmation.length} perlu scan in` : null)
          }
        />

        {/* 3. Tab Switcher di Bawah Tombol Scan: Bal Kulit vs Bahan Baku */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {[
            { id: 'BAL', label: 'Bal Kulit' },
            { id: 'BAHAN', label: 'Bahan Baku', badgeCount: incomingRawLots.length }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveWrapperTab(tab.id)}
              className={`px-4 py-2 text-xs rounded-xl border font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                activeWrapperTab === tab.id
                  ? 'bg-[#4685ac] text-white border-[#4685ac] shadow-2xs'
                  : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badgeCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                    activeWrapperTab === tab.id ? 'bg-white text-[#4685ac]' : 'bg-[#d4a340] text-white'
                  }`}
                >
                  {tab.badgeCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeWrapperTab === 'BAL' ? (
        <>
          {transitLots.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] text-[#A8862E] rounded-xl p-3 text-center text-xs font-semibold">
              {transitLots.length} bal kulit sedang diantar ke meja cetak
            </div>
          )}

          {/* 4. Daftar Lot Kulit Pangsit */}
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-[#2C3E50] font-heading whitespace-nowrap">
                Daftar Kulit
              </span>
              <span className="text-xs text-[#6B7B8D] tabular-nums font-medium">
                ({outputBalLots.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {canExport && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="h-8 px-2.5 text-xs font-semibold rounded-lg text-[#556575] hover:text-[#2C3E50] hover:bg-[#F5F1EB] border border-[#EDE8DF] bg-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  title="Unduh laporan Excel"
                  aria-label="Unduh laporan Excel"
                >
                  <svg className="w-3.5 h-3.5 text-[#556575]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[11px] font-bold">Excel</span>
                </button>
              )}

              {isPIC && lastBatchPrintModal?.lotList?.length > 1 && (
                <button
                  type="button"
                  onClick={reopenLastBatchPrintModal}
                  className="h-8 px-2.5 text-[11px] font-semibold text-[#556575] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#E2DDD3] rounded-lg cursor-pointer transition-colors"
                  title="Buka kembali QR batch terakhir"
                >
                  Rekap ({lastBatchPrintModal.lotList.length})
                </button>
              )}

              {outputBalLots.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    wrapperSelect.isSelecting
                      ? wrapperSelect.clearSelection()
                      : wrapperSelect.startSelecting()
                  }
                  className={`h-8 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-95 ${
                    wrapperSelect.isSelecting
                      ? 'bg-[#4685ac] text-white border-[#4685ac]'
                      : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                  }`}
                >
                  {wrapperSelect.isSelecting ? 'Selesai' : 'Pilih'}
                </button>
              )}
            </div>
          </div>

          {/* Section Menunggu Konfirmasi jika Mode 2x aktif */}
          {scanMode === '2X' && pendingConfirmation.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-[#F3E5C1] pb-2">
                <span className="text-xs font-bold text-[#A8862E]">
                  Menunggu Konfirmasi Stok ({pendingConfirmation.length} bal)
                </span>
                <Badge variant="warning" size="sm">
                  Perlu Scan Masuk
                </Badge>
              </div>
              <div className="space-y-1.5">
                {pendingConfirmation.map((w) => (
                  <div
                    key={w.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{w.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">{w.typeName} · {w.balQty || 1} bal</span>
                    </div>
                    <Badge variant="warning" size="sm">
                      Belum di-scan
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outputBalLots.length === 0 ? (
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-5 text-center text-[#6B7B8D] text-xs">
              Belum ada data kulit hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada lot yang memenuhi syarat) */}
              {wrapperSelect.isSelecting && eligibleWrapperLots.length > 0 && (
                <div
                  onClick={() =>
                    wrapperSelect.isAllSelected
                      ? wrapperSelect.clearSelection()
                      : wrapperSelect.selectAll()
                  }
                  className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={wrapperSelect.isAllSelected}
                      onChange={() =>
                        wrapperSelect.isAllSelected
                          ? wrapperSelect.clearSelection()
                          : wrapperSelect.selectAll()
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
                    />
                    <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                  </div>
                  <Badge variant="neutral" size="sm" tabular>
                    {eligibleWrapperLots.length} siap
                  </Badge>
                </div>
              )}

              {groupLotsByDay(outputBalLots).map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-0.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D]">
                      {group.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                      {group.items.length} bal
                    </span>
                  </div>

                  {group.items.map((w) => {
                    const isReady = w.status === 'READY_IN_WRAPPER_STATION'
                    const sizeLabel =
                      w.type === 'KULIT_7CM' || w.type === 'VAKUM_7CM' || w.type === 'VAKUM_10CM'
                        ? '7 cm (Vakum)'
                        : '9 cm (Mika)'
                    const balCount = w.balQty || 1
                    const kgCount = w.weightKg || balCount * 15

                    return (
                      <WrapperLotCard
                        key={w.lotCode}
                        lot={w}
                        sizeLabel={sizeLabel}
                        balCount={balCount}
                        kgCount={kgCount}
                        isReady={isReady}
                        scanMode={scanMode}
                        isSelected={wrapperSelect.selectedCodes.has(w.lotCode)}
                        isSelecting={wrapperSelect.isSelecting}
                        isEligible={eligibleCodesSet.has(w.lotCode)}
                        onToggle={() => wrapperSelect.toggleSelect(w.lotCode)}
                        onStartSelecting={() => wrapperSelect.startSelecting()}
                        canOpenQr={canOpenQr(userRole)}
                        onPrint={() =>
                          setPrintModal({
                            lotCode: w.lotCode,
                            title: 'LOT KULIT PANGSIT',
                            detail:
                              w.typeName ||
                              (sizeLabel.includes('7')
                                ? 'Kulit Pangsit 7 cm (Vakum)'
                                : 'Kulit Pangsit 9 cm (Mika)'),
                            weight: `${balCount} Bal (${kgCount} kg)`,
                            createdAt: w.createdAt
                          })
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Bar untuk Cetak Batch QR & Aksi Pengiriman */}
      <BatchPrintSelectionBar
        selectedCount={wrapperSelect.selectedCount}
        canOpenQr={canOpenQr(userRole, currentUser)}
        onPrint={() => openBatchPrintModal(wrapperSelect.selectedLots, 'LOT KULIT PANGSIT')}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: `Scan Out ${wrapperSelect.selectedCount} Kulit Terpilih`
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={isPIC ? handleSendSelected : undefined}
        manualDispatchLabel="Kirim terpilih"
      />
    </>
  ) : (
    /* TAB 2: BAHAN BAKU DI RUANGAN KULIT */
    <div className="space-y-3.5">
      {/* Metrik Ringkas Bahan Baku */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <Card className="border-[#EDE8DF] bg-white shadow-2xs min-h-[var(--size-hero-card,96px)] flex flex-col justify-center">
          <CardContent className="p-3 sm:p-4 text-center space-y-1">
            <span className="text-[11px] sm:text-xs text-[#6B7B8D] font-medium block leading-tight">
              Bahan di Ruangan
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-[#2C3E50] block">
              {availableRawMaterials.length} <span className="text-[11px] sm:text-xs font-normal text-[#6B7B8D]">jenis</span>
            </span>
          </CardContent>
        </Card>

        <Card className="border-[#EDE8DF] bg-white shadow-2xs min-h-[var(--size-hero-card,96px)] flex flex-col justify-center">
          <CardContent className="p-3 sm:p-4 text-center space-y-1">
            <span className="text-[11px] sm:text-xs text-[#6B7B8D] font-medium block leading-tight">
              Dalam Pengiriman
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-[#2C3E50] block">
              {incomingRawLots.length} <span className="text-[11px] sm:text-xs font-normal text-[#6B7B8D]">kiriman</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Banner Kiriman Bahan Baku Masuk (Jika Ada) */}
      {incomingRawLots.length > 0 && (
        <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
          <div className="border-b border-[#F3E5C1] pb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-[#A8862E] block">
              Kiriman bahan masuk ({incomingRawLots.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {incomingRawLots.map((b) => (
              <div
                key={b.lotCode}
                className="bg-white border border-[#F3E5C1] rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs shadow-2xs gap-2"
              >
                <div className="min-w-0 pr-1">
                  <span className="font-bold text-[#2C3E50] text-xs block truncate">
                    {b.itemName || 'Bahan Baku'}
                  </span>
                  <span className="font-mono text-[11px] text-[#6B7B8D] block">
                    {b.lotCode} · {b.quantity} {b.unit || 'KG'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      openCameraScanner({
                        mode: 'UNIVERSAL',
                        title: `Scan In ${b.lotCode}`
                      })
                    }
                    className="w-8 h-8 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] flex items-center justify-center text-[#2C3E50] transition-colors cursor-pointer active:scale-95"
                    title="Scan dengan kamera"
                    aria-label="Scan dengan kamera"
                  >
                    <CameraIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isScanningIn === b.lotCode}
                    onClick={() => handleScanInMaterial(b.lotCode)}
                    className="h-8 px-3 rounded-xl bg-[#d4a340] hover:bg-[#c29334] active:bg-[#b08328] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                    title={`Scan in lot ${b.lotCode}`}
                  >
                    <ScanIcon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                    <span>{isScanningIn === b.lotCode ? '...' : 'Scan in'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daftar Bahan Baku di Ruangan Kulit */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-[#2C3E50] font-heading whitespace-nowrap">
                Bahan Baku di Ruangan
              </span>
              <span className="text-xs text-[#6B7B8D] tabular-nums font-medium">
                ({availableRawMaterials.length})
              </span>
            </div>

            {canExport && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="h-8 px-2.5 text-xs font-semibold rounded-lg text-[#556575] hover:text-[#2C3E50] hover:bg-[#F5F1EB] border border-[#EDE8DF] bg-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Unduh laporan Excel"
                aria-label="Unduh laporan Excel"
              >
                <svg className="w-3.5 h-3.5 text-[#556575]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-[11px] font-bold">Excel</span>
              </button>
            )}
          </div>

          {availableRawMaterials.length === 0 ? (
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-5 text-center text-[#6B7B8D] text-xs">
              Belum ada bahan baku di ruangan.
            </div>
          ) : (
            <div className="space-y-2">
              {availableRawMaterials.map((item) => (
                <div
                  key={item.lotCode}
                  className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex items-center justify-between text-xs gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-[#2C3E50] text-xs block truncate">
                      {item.itemName || 'Bahan Baku'}
                    </span>
                    <span className="font-mono text-[11px] text-[#6B7B8D] block">
                      {item.lotCode}
                    </span>
                    <span className="text-[11px] text-[#6B7B8D] mt-0.5 block">
                      Tersedia: <strong className="text-[#2C3E50] tabular-nums font-bold">{item.quantity}</strong> {item.unit || 'KG'}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenRawModal(item)}
                  >
                    Gunakan
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )}

  {/* Modal Pemakaian Bahan Baku (3-Metrik) */}
  <Modal
    isOpen={Boolean(rawModalLot)}
    onClose={() => setRawModalLot(null)}
    title="Catat pemakaian bahan"
    subtitle={rawModalLot ? `${rawModalLot.itemName || 'Bahan'} · ${rawModalLot.lotCode}` : ''}
    size="sm"
  >
    {rawModalLot && (
      <div className="space-y-4">
        {/* Ringkasan Ringkas: Tersedia & Sisa */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
            <span className="text-[11px] text-[#6B7B8D] font-medium block">Tersedia</span>
            <span className="font-bold text-[#2C3E50] text-xl tabular-nums block my-0.5">
              {rawQtySent}
            </span>
            <span className="text-[10px] text-[#6B7B8D] block">{rawModalLot.unit || 'KG'}</span>
          </div>

          <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
            <span className="text-[11px] text-[#6B7B8D] font-medium block">Sisa</span>
            <span className="font-bold text-[#2C3E50] text-xl tabular-nums block my-0.5">
              {Math.max(0, Math.round(((Number(rawQtySent) || 0) - (Number(rawQtyUsed) || 0)) * 100) / 100)}
            </span>
            <span className="text-[10px] text-[#6B7B8D] block">{rawModalLot.unit || 'KG'}</span>
          </div>
        </div>

        {/* Input Stepper Jumlah Digunakan */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-[#2C3E50]">
              Jumlah digunakan
            </label>
            <span className="text-[11px] text-[#6B7B8D] tabular-nums">
              Maks {rawQtySent} {rawModalLot.unit || 'KG'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(Number(rawQtyUsed) || 0) <= 0}
              onClick={() => {
                const stepVal = (rawModalLot.unit || '').toUpperCase() === 'KG' ? 0.5 : 1
                setRawQtyUsed((val) => Math.max(0, Math.round(((Number(val) || 0) - stepVal) * 100) / 100).toString())
              }}
              className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0 active:scale-[0.98]"
              aria-label="Kurangi jumlah"
            >
              <MinusIcon className="w-5 h-5" />
            </button>

            <input
              type="number"
              step="any"
              min="0"
              max={rawQtySent}
              value={rawQtyUsed}
              onChange={(e) => {
                const maxVal = Number(rawQtySent) || 0
                const raw = e.target.value
                if (raw === '') {
                  setRawQtyUsed('')
                  return
                }
                const parsed = parseFloat(raw)
                if (isNaN(parsed) || parsed < 0) {
                  setRawQtyUsed('0')
                } else {
                  setRawQtyUsed(Math.min(maxVal, parsed).toString())
                }
              }}
              className="flex-1 h-12 text-center tabular-nums font-bold text-[#2C3E50] text-lg bg-white border-[1.5px] border-[#B7C3CE] rounded-xl focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 shadow-2xs"
              placeholder="0"
            />

            <button
              type="button"
              disabled={(Number(rawQtyUsed) || 0) >= (Number(rawQtySent) || 0)}
              onClick={() => {
                const maxVal = Number(rawQtySent) || 0
                const stepVal = (rawModalLot.unit || '').toUpperCase() === 'KG' ? 0.5 : 1
                setRawQtyUsed((val) => Math.min(maxVal, Math.round(((Number(val) || 0) + stepVal) * 100) / 100).toString())
              }}
              className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0 active:scale-[0.98]"
              aria-label="Tambah jumlah"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Opsi Sisa jika sisa > 0 */}
        {((Number(rawQtySent) || 0) - (Number(rawQtyUsed) || 0)) > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-[#2C3E50] block">
              Tindakan sisa bahan
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRawRemainingAction('STORE_IN_ROOM')}
                className={`h-10 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  rawRemainingAction === 'STORE_IN_ROOM'
                    ? 'bg-[#2C3E50] text-white border-[#2C3E50]'
                    : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                }`}
              >
                Simpan di ruangan
              </button>
              <button
                type="button"
                onClick={() => setRawRemainingAction('RETURN_TO_FRONTDESK')}
                className={`h-10 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  rawRemainingAction === 'RETURN_TO_FRONTDESK'
                    ? 'bg-[#2C3E50] text-white border-[#2C3E50]'
                    : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                }`}
              >
                Retur ke logistik
              </button>
            </div>
          </div>
        )}

        {/* Kolom Catatan */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-[#6B7B8D] block">
            Catatan (opsional)
          </span>
          <input
            type="text"
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder="Catatan..."
            className="w-full h-11 px-3.5 text-xs border border-[#EDE8DF] rounded-xl bg-white text-[#2C3E50] placeholder-[#6B7B8D] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 shadow-2xs"
          />
        </div>

        {/* Tombol Aksi Modal */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => setRawModalLot(null)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={isSavingRaw}
            disabled={isSavingRaw}
            onClick={handleSubmitRawUsage}
          >
            Simpan pemakaian
          </Button>
        </div>
      </div>
    )}
  </Modal>
</div>
)
}

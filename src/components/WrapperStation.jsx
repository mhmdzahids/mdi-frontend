import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots, groupLotsByDay } from '../utils/dateFilter'
import { PrinterIcon, ScanIcon } from './Icons'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import { Card, CardContent } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Stepper } from './ui/Stepper'
import { groupStationLots, getLotSemanticBadge } from '../utils/scanMode'
import { canOpenQr, canManualDispatch } from '../utils/permissions'
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

  const userRole = useProduction1Store((s) => s.userRole)
  const isPIC = userRole === 'STAKEHOLDER' || userRole === 'PIC'
  const wrapperLots = useProduction1Store((s) => s.wrapperLots)
  const createWrapperLot = useProduction1Store((s) => s.createWrapperLot)
  const scanOutWrapperLot = useProduction1Store((s) => s.scanOutWrapperLot)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)

  const filteredWrapperLots = filterAndSortLots(wrapperLots, 'TODAY', 'OPERATOR')

  const { mode: scanMode, pendingConfirmation, onHandStock } = groupStationLots(
    filteredWrapperLots,
    'WRAPPER_STATION',
    scanModeSettings
  )
  const readyWrappers = onHandStock

  // Hanya lot yang siap di stasiun kulit yang memenuhi syarat untuk di-scan out
  const eligibleWrapperLots = filteredWrapperLots.filter(
    (w) =>
      w.status === 'READY_IN_WRAPPER_STATION' ||
      (scanMode === '1X' && w.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleWrapperLots.map((w) => w.lotCode))
  const wrapperSelect = useLotMultiSelect(eligibleWrapperLots)

  const handleExportExcel = () => {
    exportStationLotsExcel({
      stationName: 'Divisi Kulit Dimsum',
      divisionCode: 'KULIT',
      dateStr: new Date().toISOString().slice(0, 10),
      lots: filteredWrapperLots,
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

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Status Harian & Scan Out ke Meja Cetak */}
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

        {/* Tombol Scan In dan Scan Out Terpadu */}
        <ScanActionBar
          stationId="WRAPPER_STATION"
          stationName="Kulit Dimsum"
          targetName="Meja Cetak"
          scanMode={scanMode}
          readyCount={readyWrappers.length}
          pendingCount={pendingConfirmation.length}
          inTransitCount={filteredWrapperLots.filter((w) => w.status === 'IN_TRANSIT_TO_ASSEMBLY').length}
        />
      </div>

      {/* 2. Daftar Lot Kulit Dimsum */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-[#2C3E50] font-heading whitespace-nowrap">
                Daftar Kulit
              </span>
              <span className="text-xs text-[#6B7B8D] tabular-nums font-medium">
                ({filteredWrapperLots.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
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

              {filteredWrapperLots.length > 0 && (
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

          {filteredWrapperLots.length === 0 ? (
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

              {groupLotsByDay(filteredWrapperLots).map((group) => (
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
                            title: 'LOT KULIT DIMSUM',
                            detail:
                              w.typeName ||
                              (sizeLabel.includes('7')
                                ? 'Kulit Dimsum 7 cm (Vakum)'
                                : 'Kulit Dimsum 9 cm (Mika)'),
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
        canOpenQr={canOpenQr(userRole)}
        onPrint={() => openBatchPrintModal(wrapperSelect.selectedLots, 'LOT KULIT DIMSUM')}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: `Scan Out ${wrapperSelect.selectedCount} Kulit Terpilih`
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={canManualDispatch(userRole) ? handleSendSelected : undefined}
        manualDispatchLabel="Kirim terpilih"
      />
    </div>
  )
}

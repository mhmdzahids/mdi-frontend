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
import { groupStationLots, getLotSemanticBadge } from '../utils/scanMode'
import { canOpenQr, canManualDispatch, canExportExcel } from '../utils/permissions'
import { exportStationLotsExcel } from '../utils/excelExport'
import ScanActionBar from './ScanActionBar'

function SauceLotCard({
  lot,
  variantLabel,
  countDesc,
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
          <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
            {lot.lotCode}
          </span>
          <span className="text-[11px] text-[#6B7B8D] tabular-nums block mt-0.5">
            {variantLabel} · 1 bal ({countDesc})
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

export default function SauceStation() {
  const [sauceType, setSauceType] = useState('REGULER')
  const [balQty, setBalQty] = useState('1')
  const [isSending, setIsSending] = useState(false)

  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isPIC = canManualDispatch(userRole, currentUser)
  const canExport = canExportExcel(userRole, currentUser)
  const hasQrPermission = canOpenQr(userRole, currentUser)
  const sauceLots = useProduction1Store((s) => s.sauceLots)
  const createSauceLot = useProduction1Store((s) => s.createSauceLot)
  const scanOutSauceLot = useProduction1Store((s) => s.scanOutSauceLot)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)

  const filteredSauceLots = filterAndSortLots(sauceLots, 'TODAY', 'OPERATOR')

  const { mode: scanMode, pendingConfirmation, onHandStock } = groupStationLots(
    filteredSauceLots,
    'SAUCE_STATION',
    scanModeSettings
  )
  const readySauces = onHandStock

  // Hanya lot yang siap di stasiun saos yang memenuhi syarat untuk di-scan out
  const eligibleSauceLots = filteredSauceLots.filter(
    (s) =>
      s.status === 'READY_IN_SAUCE_STATION' ||
      (scanMode === '1X' && s.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleSauceLots.map((s) => s.lotCode))
  const sauceSelect = useLotMultiSelect(eligibleSauceLots)

  const handleExportExcel = () => {
    exportStationLotsExcel({
      stationName: 'Divisi Saos Dimsum',
      divisionCode: 'SAOS',
      dateStr: new Date().toISOString().slice(0, 10),
      lots: filteredSauceLots,
      operatorName: operatorName || operatorId || 'Operator Saos'
    })
  }

  const handleSendSelected = async () => {
    if (isSending || sauceSelect.selectedCount === 0) return
    setIsSending(true)
    try {
      for (const s of sauceSelect.selectedLots) {
        await scanOutSauceLot(s.lotCode)
      }
      sauceSelect.clearSelection()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Status Harian & Scan Out ke Finishing */}
      <div className="space-y-3">
        <Card className="border-[#EDE8DF] bg-white shadow-2xs min-h-[var(--size-hero-card,96px)] flex flex-col justify-center">
          <CardContent className="p-4 text-center space-y-1">
            <span className="text-xs text-[#6B7B8D] font-medium block">
              Saos siap kirim ke finishing
            </span>
            <span className="text-3xl font-bold tabular-nums text-[#2C3E50] block">
              {readySauces.length} <span className="text-base font-normal text-[#6B7B8D]">bal</span>
            </span>
          </CardContent>
        </Card>

        {/* Tombol Scan In dan Scan Out Terpadu */}
        <ScanActionBar
          stationId="SAUCE_STATION"
          stationName="Saos Dimsum"
          targetName="Finishing / Packing"
          scanMode={scanMode}
          readyCount={readySauces.length}
          pendingCount={pendingConfirmation.length}
          inTransitCount={filteredSauceLots.filter((s) => s.status === 'IN_TRANSIT_TO_PACKING').length}
        />
      </div>

      {/* 2. Daftar Lot Saos Dimsum */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-[#2C3E50] font-heading whitespace-nowrap">
                Daftar Saos
              </span>
              <span className="text-xs text-[#6B7B8D] tabular-nums font-medium">
                ({filteredSauceLots.length})
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
                  className="h-8 px-2.5 text-[11px] font-semibold text-[#556575] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg cursor-pointer transition-all active:scale-95"
                  title="Buka kembali QR batch terakhir"
                >
                  Rekap ({lastBatchPrintModal.lotList.length})
                </button>
              )}

              {filteredSauceLots.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    sauceSelect.isSelecting
                      ? sauceSelect.clearSelection()
                      : sauceSelect.startSelecting()
                  }
                  className={`h-8 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer active:scale-95 ${
                    sauceSelect.isSelecting
                      ? 'bg-[#4685ac] text-white border-[#4685ac]'
                      : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                  }`}
                >
                  {sauceSelect.isSelecting ? 'Selesai' : 'Pilih'}
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
                {pendingConfirmation.map((s) => (
                  <div
                    key={s.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{s.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        {s.typeName || (s.type === 'MINI' ? 'Saos mini' : 'Saos reguler')} · 1 bal
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

          {filteredSauceLots.length === 0 ? (
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-5 text-center text-[#6B7B8D] text-xs">
              Belum ada data saos hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada lot yang memenuhi syarat) */}
              {sauceSelect.isSelecting && eligibleSauceLots.length > 0 && (
                <div
                  onClick={() =>
                    sauceSelect.isAllSelected
                      ? sauceSelect.clearSelection()
                      : sauceSelect.selectAll()
                  }
                  className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sauceSelect.isAllSelected}
                      onChange={() =>
                        sauceSelect.isAllSelected
                          ? sauceSelect.clearSelection()
                          : sauceSelect.selectAll()
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
                    />
                    <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                  </div>
                  <Badge variant="neutral" size="sm" tabular>
                    {eligibleSauceLots.length} siap
                  </Badge>
                </div>
              )}

              {groupLotsByDay(filteredSauceLots).map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-0.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D]">
                      {group.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                      {group.items.length} bal
                    </span>
                  </div>

                  {group.items.map((s) => {
                    const isReady = s.status === 'READY_IN_SAUCE_STATION'
                    const itemIsMini = s.type === 'MINI'
                    const variantLabel = itemIsMini ? 'Mini' : 'Reguler'
                    const countDesc = itemIsMini ? '200 plastik' : '50 pouch'

                    return (
                      <SauceLotCard
                        key={s.lotCode}
                        lot={s}
                        variantLabel={variantLabel}
                        countDesc={countDesc}
                        isReady={isReady}
                        scanMode={scanMode}
                        isSelected={sauceSelect.selectedCodes.has(s.lotCode)}
                        isSelecting={sauceSelect.isSelecting}
                        isEligible={eligibleCodesSet.has(s.lotCode)}
                        onToggle={() => sauceSelect.toggleSelect(s.lotCode)}
                        onStartSelecting={() => sauceSelect.startSelecting()}
                        canOpenQr={hasQrPermission}
                        onPrint={() =>
                          setPrintModal({
                            lotCode: s.lotCode,
                            title: 'LOT SAOS DIMSUM',
                            detail:
                              s.typeName ||
                              (itemIsMini
                                ? 'Saos Dimsum Mini (200 Plastik)'
                                : 'Saos Dimsum Reguler (50 Pouch)'),
                            weight: `1 Bal (${countDesc})`,
                            createdAt: s.createdAt,
                            lotList: [
                              {
                                lotCode: s.lotCode,
                                title: 'LOT SAOS DIMSUM',
                                detail:
                                  s.typeName ||
                                  (itemIsMini
                                    ? 'Saos Dimsum Mini (200 Plastik)'
                                    : 'Saos Dimsum Reguler (50 Pouch)'),
                                weight: `1 Bal (${countDesc})`,
                                createdAt: s.createdAt
                              }
                            ]
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
        selectedCount={sauceSelect.selectedCount}
        canOpenQr={hasQrPermission}
        onPrint={() => openBatchPrintModal(sauceSelect.selectedLots, 'LOT SAOS DIMSUM')}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: `Scan out ${sauceSelect.selectedCount} saos terpilih`
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={isPIC ? handleSendSelected : undefined}
      />
    </div>
  )
}

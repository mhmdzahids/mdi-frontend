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
import { groupStationLots } from '../utils/scanMode'
import { canOpenQr, canManualDispatch } from '../utils/permissions'

function WrapperLotCard({
  lot,
  sizeLabel,
  balCount,
  kgCount,
  isReady,
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
        <Badge
          variant={isReady ? 'warning' : 'success'}
          size="sm"
        >
          {isReady ? 'Siap' : 'Terkirim'}
        </Badge>

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

  const parsedBal = Math.max(1, parseInt(balQty, 10) || 1)
  const totalWeight = parsedBal * 15

  const handleCreate = (e) => {
    e.preventDefault()
    if (parsedBal <= 0) return
    createWrapperLot(wrapperType, parsedBal, 'INTERNAL', '')
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

  const wrapperOptions = [
    { value: 'KULIT_7CM', label: '7 cm' },
    { value: 'KULIT_9CM', label: '9 cm' }
  ]

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Tampilan Khusus PIC: Cetak Label Kulit */}
      {isPIC ? (
        <Card variant="action" className="border-[#D1E4EF] bg-white">
          <CardContent className="p-4 space-y-3.5">
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="border-b border-[#EDE8DF] pb-2.5">
                <span className="text-xs font-bold text-[#2C3E50]">
                  Cetak label kulit
                </span>
              </div>

              {/* Segmented Ukuran Kulit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C3E50]">
                  Ukuran kulit
                </label>
                <SegmentedControl
                  options={wrapperOptions}
                  value={wrapperType}
                  onChange={(val) => setWrapperType(val)}
                />
              </div>

              {/* Stepper Jumlah Bal */}
              <Stepper
                label="Jumlah bal"
                value={parsedBal}
                onChange={(val) => setBalQty(String(val))}
                min={1}
                presets={[1, 2, 5, 10]}
                conversionText={`= ${totalWeight} kg`}
              />

              {/* Tombol Cetak Utama 56px */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                icon={PrinterIcon}
              >
                Cetak label
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* 2. Tampilan Khusus Pegawai: Status & Scan Out ke Meja Cetak */
        <div className="space-y-3">
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 text-center space-y-1">
              <span className="text-xs text-[#6B7B8D] font-medium block">
                Kulit siap kirim ke meja cetak
              </span>
              <span className="text-3xl font-bold tabular-nums text-[#2C3E50] block">
                {readyWrappers.length} <span className="text-base font-normal text-[#6B7B8D]">bal</span>
              </span>
            </CardContent>
          </Card>

          {/* Tombol Scan Out Kulit ke Meja Cetak */}
          {readyWrappers.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() =>
                openCameraScanner({
                  mode: 'UNIVERSAL',
                  title: 'Scan Out Kulit ke Meja Cetak'
                })
              }
              icon={ScanIcon}
            >
              Scan Out Kulit ke Cetak ({readyWrappers.length} siap)
            </Button>
          )}
        </div>
      )}

      {/* 3. Daftar Lot Kulit Dimsum */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2C3E50]">
                Daftar kulit
              </span>
              <Badge variant="neutral" size="sm" tabular>
                {filteredWrapperLots.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              {lastBatchPrintModal?.lotList?.length > 1 && (
                <button
                  type="button"
                  onClick={reopenLastBatchPrintModal}
                  className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2.5 py-1 cursor-pointer transition-all active:scale-95"
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
                  className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer active:scale-95 ${
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
                        isSelected={wrapperSelect.selectedCodes.has(w.lotCode)}
                        isSelecting={wrapperSelect.isSelecting}
                        isEligible={eligibleCodesSet.has(w.lotCode)}
                        onToggle={() => wrapperSelect.toggleSelect(w.lotCode)}
                        onStartSelecting={() => wrapperSelect.startSelecting()}
                        isPIC={isPIC}
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

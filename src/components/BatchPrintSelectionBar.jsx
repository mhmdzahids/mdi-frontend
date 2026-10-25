import { useState, useRef, useEffect } from 'react'
import { CameraIcon, SendIcon, PrinterIcon, MoreVerticalIcon, XIcon } from './Icons'

/**
 * Bar Aksi Bawah Mengambang (Selection Action Bar)
 *
 * Ditampilkan saat user memilih satu atau beberapa lot.
 * Memenuhi standar:
 * - 1 baris ramping (tinggi 64-68px, tidak pernah wrap)
 * - Menempel tepat di atas BottomNav (bottom-[calc(64px+env(safe-area-inset-bottom))])
 * - Latar permukaan hangat dari token (#FAF7F2) dengan border halus #EDE8DF
 * - Kontras teks dan ikon tinggi (> 4.5:1)
 * - Tombol utama berlabel pendek ('Scan out'), flex: 1, tinggi 48-52px, warna aksen #4685ac
 * - Aksi sekunder (kirim, cetak) berupa tombol vertikal ikon + label 11px, lebar ~52-56px
 * - Aksi destruktif ('Batalkan sisa') berada di menu 'Lainnya' dengan gaya danger outline/text
 * - Semua elemen anak flex memakai min-width: 0 agar tidak mendorong keluar layar
 */
export default function BatchPrintSelectionBar({
  selectedCount = 0,
  canOpenQr = false,
  onPrint,
  onScanOut,
  scanOutLabel = 'Scan out',
  onManualDispatch,
  manualDispatchLabel = 'Kirim',
  actionLabel,
  onAction,
  actionDisabled = false,
  actionClassName
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreRef = useRef(null)

  // Listener click outside & escape key untuk menutup menu Lainnya
  useEffect(() => {
    if (!isMoreOpen) return

    function handleClickOutside(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setIsMoreOpen(false)
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMoreOpen])

  // Bar tidak muncul bila belum ada yang dipilih
  if (selectedCount === 0) return null

  // Deteksi apakah aksi kustom berupa aksi sekunder destruktif (ditampung di menu Lainnya)
  // atau aksi primer tunggal (seperti di Inbound Produksi 2 yang tidak memiliki tombol Scan Out)
  const isDestructiveOrSecondary = Boolean(onScanOut && actionLabel && onAction)
  const isPrimaryCustomAction = Boolean(!onScanOut && actionLabel && onAction)

  return (
    <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-0 right-0 max-w-md md:max-w-xl mx-auto px-3.5 z-40 pointer-events-none">
      <div className="pointer-events-auto min-h-[64px] h-[68px] bg-[#FAF7F2] text-[#2C3E50] rounded-2xl px-3 shadow-lg border border-[#EDE8DF] flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 box-border select-none">
        {/* Kontainer Baris Fleksibel: Menyesuaikan jumlah aksi per role tanpa overflow */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
          {/* 1. Tombol Sekunder Vertikal: Kirim Manual (Khusus PIC) */}
          {onManualDispatch && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onManualDispatch}
              className="w-[52px] sm:w-[56px] min-w-[48px] h-[50px] min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl border border-[#EDE8DF] bg-white text-[#2C3E50] hover:bg-[#F5F1EB] active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title={manualDispatchLabel || 'Kirim terpilih'}
              aria-label={manualDispatchLabel || 'Kirim terpilih'}
            >
              <SendIcon className="w-4 h-4 text-[#2C3E50] shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#2C3E50] leading-tight mt-0.5 tracking-tight truncate max-w-full">
                Kirim
              </span>
            </button>
          )}

          {/* 2. Tombol Sekunder Vertikal: Cetak / Buka QR (Hanya Role Berizin) */}
          {canOpenQr && onPrint && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onPrint}
              className="w-[52px] sm:w-[56px] min-w-[48px] h-[50px] min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl border border-[#EDE8DF] bg-white text-[#2C3E50] hover:bg-[#F5F1EB] active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Cetak ulang barcode"
              aria-label="Cetak ulang barcode"
            >
              <PrinterIcon className="w-4 h-4 text-[#2C3E50] shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#2C3E50] leading-tight mt-0.5 tracking-tight truncate max-w-full">
                Cetak
              </span>
            </button>
          )}

          {/* 3. Tombol 'Lainnya' (Menu Popover untuk Aksi Destruktif seperti Batalkan Sisa) */}
          {isDestructiveOrSecondary && (
            <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className={`w-[52px] sm:w-[56px] min-w-[48px] h-[50px] min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
                  isMoreOpen
                    ? 'border-[#4685ac] bg-[#EEF5F9] text-[#4685ac]'
                    : 'border-[#EDE8DF] bg-white text-[#2C3E50] hover:bg-[#F5F1EB]'
                }`}
                title="Pilihan lainnya"
                aria-label="Pilihan lainnya"
              >
                <MoreVerticalIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight mt-0.5 tracking-tight truncate max-w-full">
                  Lainnya
                </span>
              </button>

              {/* Popover Menu ke Atas */}
              {isMoreOpen && (
                <div className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 bg-white border border-[#EDE8DF] rounded-xl shadow-xl p-1.5 min-w-[200px] z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false)
                      onAction()
                    }}
                    disabled={actionDisabled}
                    className="w-full min-h-[44px] px-3 py-2 text-left rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/60 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XIcon className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate">
                      {actionLabel} ({selectedCount})
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Aksi Primer Kustom (jika tidak ada Scan Out, misal di Tab Inbound Produksi 2) */}
          {isPrimaryCustomAction && (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className={
                actionClassName ||
                'flex-1 min-w-0 min-h-[48px] h-12 px-4 bg-[#2C3E50] text-white rounded-xl text-xs font-bold hover:bg-[#151E27] disabled:opacity-50 transition-all cursor-pointer shadow-2xs active:scale-[0.98]'
              }
            >
              <span className="truncate">{actionLabel}</span>
            </button>
          )}

          {/* 5. Tombol Utama: Scan Out Kamera (flex-1 mengisi sisa ruang secara proporsional) */}
          {onScanOut && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onScanOut}
              className="flex-1 min-w-0 min-h-[48px] h-12 bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] text-white px-3 sm:px-4 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4 shrink-0 text-white" />
              <span className="truncate">{scanOutLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

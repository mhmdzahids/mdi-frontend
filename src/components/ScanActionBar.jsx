import { useProduction1Store } from '../store/production1Store'
import { ScanInIcon, ScanOutIcon } from './Icons'
import ScanFeedbackBanner from './ScanFeedbackBanner'

/**
 * Komponen Bersama ScanActionBar untuk 4 Halaman Karyawan MES:
 * - Giling & Mix (Daging & Adonan)
 * - Bumbu Sparta
 * - Kulit Dimsum
 * - Saos Dimsum
 * 
 * Karakteristik Visual & Perilaku:
 * - Menekan tombol langsung membuka window kamera pemindai
 * - Tinggi seragam min-h-[var(--size-hero-card,96px)] sejajar kartu ringkasan
 * - Latar solid brand-blue (#4685ac), teks & ikon putih dari lucide-react
 * - Responsive & tahan skala font 130%
 */
export default function ScanActionBar({
  stationId,
  stationName,
  targetName = 'Divisi Tujuan',
  scanMode = '1X',
  readyCount = 0,
  pendingCount = 0,
  inTransitCount = 0,
  scanInSubtext,
  className = ''
}) {
  const startScanSession = useProduction1Store((s) => s.startScanSession)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  // Aturan tampil tombol:
  // - Di Giling & Mix (MEAT_STATION): Scan In SELALU tampil di mode 1x maupun 2x (dipakai terima bumbu).
  // - Di Bumbu, Kulit, dan Saos: Scan In disembunyikan di mode 1x (hanya Scan Out selebar layar). Di mode 2x keduanya tampil.
  const isMeatStation = stationId === 'MEAT_STATION'
  const showScanIn = isMeatStation || scanMode === '2X'
  const isSingleButton = !showScanIn

  // Keterangan teks Scan In (Scan Out bersih tanpa badge)
  const resolvedScanInText = scanInSubtext !== undefined
    ? scanInSubtext
    : (isMeatStation && inTransitCount > 0
        ? `${inTransitCount} kiriman bumbu`
        : (scanMode === '2X' && pendingCount > 0
            ? `${pendingCount} perlu scan in`
            : null))

  // Klik langsung buka modal kamera pemindai
  const handleScanIn = () => {
    startScanSession(stationId, 'SCAN_IN')
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(50)
    }
    openCameraScanner({
      mode: 'UNIVERSAL',
      title: `Scan In ${stationName}`
    })
  }

  const handleScanOut = () => {
    startScanSession(stationId, 'SCAN_OUT')
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(50)
    }
    openCameraScanner({
      mode: 'UNIVERSAL',
      title: `Scan Out ${stationName}`
    })
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* 1. GRID TOMBOL SCAN: SEJAJAR, DENGAN IKON & BULAT-BULAT BACKGROUND */}
      <div className={`grid gap-2.5 sm:gap-3 ${isSingleButton ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* TOMBOL SCAN IN */}
        {showScanIn && (
          <button
            type="button"
            onClick={handleScanIn}
            className="min-h-[104px] sm:min-h-[114px] rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-[0.98] select-none shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E50] focus-visible:ring-offset-2 relative overflow-hidden bg-[#4685ac] hover:bg-[#3d7597] text-white"
            title="Scan in untuk menerima atau memasukkan barang ke stok fisik"
          >
            {/* Bulat-bulat dekorasi di background */}
            <div className="absolute -top-7 -right-7 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute top-1 right-3 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

            {/* Kotak Transparan Ikon */}
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 flex items-center justify-center mb-1.5 border border-white/20 shadow-2xs backdrop-blur-[1px] relative z-10 shrink-0">
              <ScanInIcon size={26} strokeWidth={2.2} className="text-white" />
            </div>

            {/* Label Tebal (Sentence Case: Scan in) */}
            <span className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-tight block relative z-10">
              Scan in
            </span>

            {/* Keterangan Kecil Berupa Pill Putih Kontras Tinggi */}
            {resolvedScanInText && (
              <span className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#2C3E50] shadow-2xs tabular-nums block max-w-full truncate leading-tight relative z-10">
                {resolvedScanInText}
              </span>
            )}
          </button>
        )}

        {/* TOMBOL SCAN OUT */}
        <button
          type="button"
          onClick={handleScanOut}
          className={`min-h-[104px] sm:min-h-[114px] ${
            isSingleButton ? 'w-full' : ''
          } rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer active:scale-[0.98] select-none shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A23D] focus-visible:ring-offset-2 relative overflow-hidden bg-[#d4a340] hover:bg-[#c29334] text-white`}
          title={`Scan out untuk mengirim barang menuju ${targetName}`}
        >
          {/* Bulat-bulat dekorasi di background */}
          <div className="absolute -top-7 -right-7 w-28 h-28 rounded-full bg-white/15 pointer-events-none" />
          <div className="absolute top-1 right-3 w-14 h-14 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

          {/* Kotak Transparan Ikon */}
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 flex items-center justify-center mb-1.5 border border-white/20 shadow-2xs backdrop-blur-[1px] relative z-10 shrink-0">
            <ScanOutIcon size={26} strokeWidth={2.2} className="text-white" />
          </div>

          {/* Label Tebal (Sentence Case: Scan out) */}
          <span className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-tight block relative z-10">
            Scan out
          </span>
        </button>
      </div>

      {/* 2. HASIL SCAN SEMANTIK BESAR DENGAN TOMBOL UNDO */}
      <ScanFeedbackBanner />
    </div>
  )
}

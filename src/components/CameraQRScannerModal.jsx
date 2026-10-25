import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useProduction1Store } from '../store/production1Store'
import { XIcon, FlashIcon, SwitchCameraIcon, CheckIcon, AlertIcon, ScanIcon, ClockIcon } from './Icons'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

function CameraScannerInner() {
  useLockBodyScroll(true)
  const cameraScannerConfig = useProduction1Store((s) => s.cameraScannerConfig)
  const closeCameraScanner = useProduction1Store((s) => s.closeCameraScanner)
  const processUniversalBarcode = useProduction1Store((s) => s.processUniversalBarcode)
  const triggerScanUndo = useProduction1Store((s) => s.triggerScanUndo)

  // Dynamic Scan Cooldown Interval State
  const scanCooldownSeconds = useProduction1Store((s) => s.scanCooldownSeconds)
  const setScanCooldownSeconds = useProduction1Store((s) => s.setScanCooldownSeconds)

  // Mixing selection state
  const selectedMeatCodes = useProduction1Store((s) => s.selectedMeatCodes)
  const selectedBumbuCodes = useProduction1Store((s) => s.selectedBumbuCodes)
  const clearMixSelection = useProduction1Store((s) => s.clearMixSelection)

  const [facingMode, setFacingMode] = useState('environment') // 'environment' | 'user'
  const [torchOn, setTorchOn] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [lastScannedResult, setLastScannedResult] = useState(null)

  // Cooldown countdown visual state
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownTimerRef = useRef(null)
  const isProcessingScanRef = useRef(false)

  const scannerRef = useRef(null)
  const lastScanTimeRef = useRef({ code: '', time: 0 })
  const html5QrCodeId = 'html5-qr-camera-viewport'

  const isMixingMode = cameraScannerConfig?.mode === 'MIXING_MATCH'
  const title =
    cameraScannerConfig?.title ||
    (isMixingMode ? 'Scan bahan mix (daging & bumbu)' : 'Scan barcode / QR kamera')

  // Cleanup timer saat unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }
    }
  }, [])

  // Handle scanned code dengan jeda interval dinamis
  const handleScanCode = async (scannedText) => {
    const clean = (scannedText || '').trim().toUpperCase()
    if (!clean) return

    const now = Date.now()
    const cooldownMs = (scanCooldownSeconds || 3) * 1000

    // Abaikan jika kode yang sama di-scan lagi dalam masa jeda
    if (lastScanTimeRef.current.code === clean && now - lastScanTimeRef.current.time < cooldownMs) {
      return
    }

    // Abaikan frame jika proses scan sebelumnya masih berjalan
    if (isProcessingScanRef.current) {
      return
    }
    isProcessingScanRef.current = true

    lastScanTimeRef.current = { code: clean, time: now }

    // Mulai hitung mundur jeda visual
    const initialCooldown = scanCooldownSeconds || 3
    setCooldownRemaining(initialCooldown)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)

    let secondsLeft = initialCooldown
    cooldownTimerRef.current = setInterval(() => {
      secondsLeft -= 1
      if (secondsLeft <= 0) {
        clearInterval(cooldownTimerRef.current)
        setCooldownRemaining(0)
      } else {
        setCooldownRemaining(secondsLeft)
      }
    }, 1000)

    try {
      const res = await processUniversalBarcode(clean)
      setLastScannedResult(res)

      // Clear result message setelah 3.5 detik
      setTimeout(() => {
        setLastScannedResult((prev) => (prev?.code === clean ? null : prev))
      }, 3500)
    } finally {
      isProcessingScanRef.current = false
    }
  }

  const handleScanCodeRef = useRef(handleScanCode)
  useEffect(() => {
    handleScanCodeRef.current = handleScanCode
  })

  // Lifecycle Scanner Kamera
  useEffect(() => {
    let isMounted = true
    let html5QrCode = null

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(html5QrCodeId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const qrboxSize = Math.floor(minEdge * 0.72)
            return { width: qrboxSize, height: qrboxSize }
          },
          aspectRatio: 1.0,
        }

        await html5QrCode.start(
          { facingMode: facingMode },
          config,
          (decodedText) => {
            if (isMounted && handleScanCodeRef.current) {
              handleScanCodeRef.current(decodedText)
            }
          },
          () => {
            // Frame scan failure (abaikan, normal saat mencari frame QR)
          }
        )

        if (isMounted) {
          setIsCameraActive(true)
        }
      } catch (err) {
        if (isMounted) {
          setIsCameraActive(false)
          setCameraError(
            err?.message || 'Gagal mengakses kamera. Pastikan izin kamera aktif di browser.'
          )
        }
      }
    }

    // Delay sedikit agar DOM div viewport ter-render
    const timer = setTimeout(() => {
      startScanner()
    }, 150)

    return () => {
      isMounted = false
      clearTimeout(timer)
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current
            .stop()
            .then(() => {
              try {
                scannerRef.current?.clear()
              } catch {
                // ignore
              }
            })
            .catch(() => {})
        }
        scannerRef.current = null
      }
    }
  }, [facingMode])

  // Toggle Senter / Flash
  const handleToggleTorch = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        const nextState = !torchOn
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState }]
        })
        setTorchOn(nextState)
      }
    } catch {
      // Perangkat atau browser tidak mendukung kontrol senter
    }
  }

  // Toggle Kamera Depan / Belakang
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overscroll-contain select-none"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      <div className="w-full max-w-md bg-neutral-900 text-white rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden border border-neutral-800 shadow-2xl max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-4 py-3 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ScanIcon className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-100">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            {isCameraActive && (
              <>
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  title="Flashlight"
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    torchOn
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  <FlashIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  title="Ganti Kamera"
                  className="w-9 h-9 flex items-center justify-center bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  <SwitchCameraIcon className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={closeCameraScanner}
              className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
              aria-label="Tutup"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bar Pengaturan Interval Jeda Dinamis */}
        <div className="px-4 py-2 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <ClockIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-neutral-300">Jeda scan:</span>
          </div>

          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setScanCooldownSeconds(sec)}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  scanCooldownSeconds === sec
                    ? 'bg-[#4685ac] text-white shadow-xs ring-1 ring-white/30'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
                title={`Atur jeda ${sec} detik setelah scan berhasil`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Status Bar Mixing Khusus */}
        {isMixingMode && (
          <div className="px-4 py-2.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 text-xs">Bahan Terpilih:</span>
              <span className="font-mono font-bold text-white bg-neutral-800 px-2.5 py-1 rounded-md border border-neutral-700">
                {selectedMeatCodes.length} Daging : {selectedBumbuCodes.length} Bumbu
              </span>
            </div>
            {(selectedMeatCodes.length > 0 || selectedBumbuCodes.length > 0) && (
              <button
                type="button"
                onClick={clearMixSelection}
                className="text-xs text-neutral-300 hover:text-white underline cursor-pointer p-1"
              >
                Reset Pilihan
              </button>
            )}
          </div>
        )}

        {/* Viewport Kamera */}
        <div className="relative w-full bg-black aspect-square max-h-[300px] flex items-center justify-center overflow-hidden">
          {/* Elemen mount target html5-qrcode (sembunyikan shaded-region bawaan) */}
          <div id={html5QrCodeId} className="w-full h-full [&_#qr-shaded-region]:!hidden" />

          {/* Indikator Status Floating di Atas Viewport */}
          {cooldownRemaining > 0 ? (
            <div className="absolute top-3 px-3.5 py-1 bg-amber-500/95 text-neutral-950 text-xs font-extrabold rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150 z-20">
              <ClockIcon className="w-3.5 h-3.5 text-neutral-950 animate-spin" />
              <span>Jeda {cooldownRemaining}s (Kamera istirahat)</span>
            </div>
          ) : isCameraActive ? (
            <div className="absolute top-3 px-3 py-1 bg-emerald-500/85 text-neutral-950 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-xs z-20">
              <ScanIcon className="w-3.5 h-3.5 text-neutral-950" />
              <span>Kamera aktif · Siap scan</span>
            </div>
          ) : null}

          {/* 1 BINGKAI SCANNER TUNGGAL SIMETRIS (Transisi warna saat jeda) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className={`w-52 h-52 sm:w-60 sm:h-60 relative rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors duration-300 ${
                cooldownRemaining > 0 ? 'border-amber-400' : 'border-emerald-400'
              }`}
            >
              {/* Sudut-sudut Reticle */}
              <div
                className={`absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 transition-colors duration-300 ${
                  cooldownRemaining > 0 ? 'border-amber-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 transition-colors duration-300 ${
                  cooldownRemaining > 0 ? 'border-amber-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 transition-colors duration-300 ${
                  cooldownRemaining > 0 ? 'border-amber-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 transition-colors duration-300 ${
                  cooldownRemaining > 0 ? 'border-amber-400' : 'border-emerald-400'
                }`}
              />

              {/* Garis Laser Animasi (Hanya berdenyut saat tidak sedang jeda) */}
              {isCameraActive && cooldownRemaining === 0 && (
                <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          {/* Overlay Pesan Error Kamera jika izin ditolak */}
          {cameraError && (
            <div className="absolute inset-0 bg-neutral-900/95 p-4 flex flex-col items-center justify-center text-center z-10 space-y-2">
              <AlertIcon className="w-6 h-6 text-rose-500" />
              <p className="text-xs text-rose-300 font-medium px-4">{cameraError}</p>
            </div>
          )}

          {/* Banner Toast Hasil Scan Terakhir */}
          {lastScannedResult && (
            <div
              className={`absolute bottom-3 left-3 right-3 p-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xl backdrop-blur-sm z-20 transition-all ${
                lastScannedResult.success
                  ? 'bg-emerald-950/95 border border-emerald-500/80 text-emerald-100'
                  : 'bg-rose-950/95 border border-rose-500/80 text-rose-100'
              }`}
            >
              {lastScannedResult.success ? (
                <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertIcon className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div className="flex-1 truncate font-mono text-xs">
                <span className="font-bold mr-1">{lastScannedResult.code}:</span>
                <span>{lastScannedResult.message}</span>
              </div>
              {lastScannedResult.data?.can_undo && (
                <button
                  type="button"
                  onClick={async () => {
                    await triggerScanUndo(lastScannedResult.code)
                    setLastScannedResult(null)
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95"
                >
                  Batal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Kontrol Bawah Bersih: Hanya Tombol Selesai */}
        <div className="p-3 bg-neutral-900 border-t border-neutral-800">
          <button
            type="button"
            onClick={closeCameraScanner}
            className="w-full min-h-[48px] bg-[#4685ac] hover:bg-[#3A6B80] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-[0.98]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CameraQRScannerModal() {
  const isCameraScannerOpen = useProduction1Store((s) => s.isCameraScannerOpen)
  if (!isCameraScannerOpen) return null
  return <CameraScannerInner />
}

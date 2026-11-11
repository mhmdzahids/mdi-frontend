import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Zap, ZapOff } from 'lucide-react'

/**
 * Scanner Kamera Cepat untuk POS.
 * Mendukung continuous scan (scan berkali-kali tanpa menutup kamera)
 * dengan audio feedback seketika.
 */
export default function POSCameraScannerModal({ isOpen, onClose, onScan, title = 'Scan Kemasan Dimsum' }) {
  const [torchOn, setTorchOn] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [lastScanned, setLastScanned] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const scannerRef = useRef(null)
  const lastCodeRef = useRef({ code: '', time: 0 })
  const html5QrCodeId = 'pos-html5-camera-viewport'

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    let scanner = null

    const startScanner = async () => {
      try {
        setCameraError(null)
        scanner = new Html5Qrcode(html5QrCodeId)
        scannerRef.current = scanner

        const config = {
          fps: 15,
          qrbox: (viewWidth, viewHeight) => {
            const edge = Math.min(viewWidth, viewHeight)
            return { width: Math.floor(edge * 0.75), height: Math.floor(edge * 0.75) }
          },
          aspectRatio: 1.0
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          async (decodedText) => {
            if (!isMounted || !decodedText) return
            const clean = decodedText.trim().toUpperCase()

            const now = Date.now()
            // Throttle: abaikan jika kode yang sama dibaca dalam 2.5 detik
            if (lastCodeRef.current.code === clean && now - lastCodeRef.current.time < 2500) {
              return
            }

            if (isProcessing) return
            setIsProcessing(true)
            lastCodeRef.current = { code: clean, time: now }

            try {
              setLastScanned(clean)
              await onScan(clean)
            } catch (err) {
              console.error('Scan error:', err)
            } finally {
              setTimeout(() => {
                if (isMounted) setIsProcessing(false)
              }, 500)
            }
          },
          () => {}
        )
      } catch (err) {
        if (isMounted) {
          setCameraError(err?.message || 'Gagal menyalakan kamera. Berikan izin di browser.')
        }
      }
    }

    startScanner()

    return () => {
      isMounted = false
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {}).then(() => {
              scannerRef.current?.clear()
            })
          }
        } catch {
          // ignore cleanup error
        }
      }
    }
  }, [isOpen, onScan, isProcessing])

  const toggleTorch = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning) return
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn }]
      })
      setTorchOn(!torchOn)
    } catch {
      // Perangkat mungkin tidak mendukung flash
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-between p-4 safe-area-padding select-none">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between text-white py-2">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#4685ac]" />
          <span className="text-sm font-bold tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTorch}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
            aria-label="Senter"
          >
            {torchOn ? <Zap className="w-5 h-5 text-yellow-300" /> : <ZapOff className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Viewport Area */}
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center relative">
        <div className="w-full aspect-square max-w-[320px] rounded-3xl overflow-hidden relative border-2 border-white/30 shadow-2xl bg-black">
          <div id={html5QrCodeId} className="w-full h-full" />

          {/* Scanner Overlay Box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[72%] h-[72%] border-2 border-[#4685ac] rounded-2xl relative">
              <span className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-[#4685ac]" />
              <span className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-[#4685ac]" />
              <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-[#4685ac]" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-[#4685ac]" />
            </div>
          </div>
        </div>

        {/* Feedback Terakhir */}
        {lastScanned && (
          <div className="mt-3 bg-white/95 text-[#2C3E50] px-4 py-1.5 rounded-full text-xs font-bold shadow-md animate-pulse">
            Terscan: {lastScanned}
          </div>
        )}

        {cameraError && (
          <div className="mt-4 bg-rose-500/90 text-white text-xs p-3 rounded-xl max-w-xs text-center">
            {cameraError}
          </div>
        )}
      </div>

      {/* Bottom Dismiss */}
      <div className="w-full max-w-md pb-4 text-center">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-white text-[#2C3E50] rounded-xl font-bold text-sm shadow-lg active:scale-98 transition-all cursor-pointer"
        >
          Selesai Scan
        </button>
      </div>
    </div>
  )
}

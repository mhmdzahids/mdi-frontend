import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Zap, ZapOff } from 'lucide-react'

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
            // Throttle: abaikan jika kode yang sama dibaca dalam 2 detik
            if (lastCodeRef.current.code === clean && now - lastCodeRef.current.time < 2000) {
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
          setCameraError(err?.message || 'Gagal menyalakan kamera. Berikan izin akses kamera di browser.')
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
          // ignore
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
      alert('Lampu flash tidak didukung di perangkat atau kamera ini.')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-sm bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 z-10 text-white"
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/10 bg-neutral-900/90 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold font-heading tracking-wide uppercase">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={toggleTorch}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Lampu Flash"
              >
                {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Viewport Kamera dengan Animated Laser HUD */}
          <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
            <div id={html5QrCodeId} className="w-full h-full" />

            {/* Target Reticle Viewfinder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[72%] h-[72%] border-2 border-emerald-400/70 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Corner accents */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm" />
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm" />
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm" />
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-sm" />

                {/* Animated Sweeping Laser Line */}
                <motion.div
                  animate={{ y: [0, 180, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399]"
                />
              </div>
            </div>

            {/* Kamera Error Fallback */}
            {cameraError && (
              <div className="absolute inset-0 bg-neutral-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <span className="text-xs text-rose-400 font-bold">{cameraError}</span>
                <span className="text-[11px] text-neutral-400">
                  Gunakan input barcode manual atau scanner tembak fisik.
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-bold"
                >
                  Tutup Kamera
                </button>
              </div>
            )}
          </div>

          {/* Footer Info Pill */}
          <div className="p-3.5 bg-neutral-900 border-t border-white/10 text-center space-y-1">
            <span className="text-[11px] text-neutral-300 block">
              {lastScanned ? (
                <span className="text-emerald-400 font-mono font-bold">
                  ✓ Berhasil: {lastScanned}
                </span>
              ) : (
                'Arahkan kotak ke barcode kemasan dimsum'
              )}
            </span>
            <span className="text-[10px] text-neutral-500 block">
              Scan terus-menerus tanpa perlu menutup kamera
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

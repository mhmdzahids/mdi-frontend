import { useState, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'

/**
 * ImageCropperModal
 * Editor crop rasio 1:1 terkunci dengan kontrol geser (pan), cubit/slider (zoom).
 * Merender hasil ke canvas 800x800 persegi dan mengekspor WebP kualitas ~80%.
 */
export default function ImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete
}) {
  useLockBodyScroll(isOpen)

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [prevSrc, setPrevSrc] = useState(imageSrc)

  if (imageSrc !== prevSrc) {
    setPrevSrc(imageSrc)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const containerRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPinchDistRef = useRef(null)
  const initialZoomRef = useRef(1)

  // Drag / Pan Mouse & Touch Handlers
  const handlePointerDown = (e) => {
    // Abaikan jika pinch 2 jari
    if (e.touches && e.touches.length > 1) return
    isDraggingRef.current = true
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    dragStartRef.current = {
      x: clientX - offset.x,
      y: clientY - offset.y
    }
  }

  const handlePointerMove = (e) => {
    // Touch pinch gesture handler (2 jari)
    if (e.touches && e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

      if (initialPinchDistRef.current === null) {
        initialPinchDistRef.current = dist
        initialZoomRef.current = zoom
      } else {
        const scaleChange = dist / initialPinchDistRef.current
        const newZoom = Math.min(3, Math.max(1, initialZoomRef.current * scaleChange))
        setZoom(newZoom)
      }
      return
    }

    if (!isDraggingRef.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    setOffset({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y
    })
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
    initialPinchDistRef.current = null
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    setZoom((prev) => Math.min(3, Math.max(1, prev + delta)))
  }

  // Eksekusi render ke canvas 800x800 & ekspor WebP
  const handleConfirmCrop = useCallback(async () => {
    if (!imageSrc || isProcessing) return
    setIsProcessing(true)

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageSrc
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Ukuran crop box di UI (viewport)
      const cropBoxSize = 280 // px
      const baseScale = Math.max(cropBoxSize / img.naturalWidth, cropBoxSize / img.naturalHeight)
      const currentScale = baseScale * zoom

      // Hitung koordinat source image
      // Titik tengah cropbox dipetakan ke titik tengah gambar setelah offset & zoom
      const scaledWidth = img.naturalWidth * currentScale
      const scaledHeight = img.naturalHeight * currentScale

      // Posisi pojok kiri atas gambar relatif terhadap crop box
      const imgLeftInView = (cropBoxSize - scaledWidth) / 2 + offset.x
      const imgTopInView = (cropBoxSize - scaledHeight) / 2 + offset.y

      // Hitung crop rect pada gambar asli
      const srcX = Math.max(0, (0 - imgLeftInView) / currentScale)
      const srcY = Math.max(0, (0 - imgTopInView) / currentScale)
      const srcW = Math.min(img.naturalWidth - srcX, cropBoxSize / currentScale)
      const srcH = Math.min(img.naturalHeight - srcY, cropBoxSize / currentScale)

      // Gambar ke canvas 800x800
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, 800, 800)
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 800, 800)

      // Ekspor WebP kualitas 82% (fallback ke JPEG jika browser tidak mendukung WebP)
      let blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.82)
      })

      if (!blob) {
        blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
        })
      }

      onCropComplete(blob)
      onClose()
    } catch (err) {
      console.error('Failed to crop image:', err)
      alert('Gagal memproses crop gambar. Silakan coba lagi.')
    } finally {
      setIsProcessing(false)
    }
  }, [imageSrc, zoom, offset, isProcessing, onCropComplete, onClose])

  if (!isOpen || !imageSrc) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header Modal */}
          <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between">
            <span className="text-xs font-bold text-[#2C3E50]">Sesuaikan Foto (1:1)</span>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:bg-[#F5F1EB] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Area Crop Interaktif (Locked 1:1) */}
          <div className="p-4 flex flex-col items-center justify-center bg-[#1A1A1A]">
            <div
              ref={containerRef}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              onWheel={handleWheel}
              className="relative w-[280px] h-[280px] rounded-xl overflow-hidden bg-black cursor-grab active:cursor-grabbing touch-none flex items-center justify-center border-2 border-white/80 shadow-inner"
              style={{ width: '280px', height: '280px' }}
            >
              {/* Image Transform Layer */}
              <img
                src={imageSrc}
                alt="Crop Preview"
                draggable={false}
                className="max-w-none pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />

              {/* Grid Guides 3x3 Lembut */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/30">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            </div>

            <p className="text-[11px] text-white/60 mt-2 text-center">
              Geser dan cubit / gunakan slider untuk mengatur posisi
            </p>
          </div>

          {/* Slider Zoom Control */}
          <div className="px-5 py-3 bg-[#F5F1EB] border-t border-[#EDE8DF] flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-[#6B7B8D] shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-[#3A6B80] h-1.5 bg-[#EDE8DF] rounded-lg cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-[#6B7B8D] shrink-0" />
            <span className="text-xs font-bold text-[#2C3E50] w-9 text-right tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons Footer */}
          <div className="p-3.5 bg-white border-t border-[#EDE8DF] grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="min-h-[44px] px-3 bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#6B7B8D] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={isProcessing}
              className="min-h-[44px] px-3 bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Gunakan Foto</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

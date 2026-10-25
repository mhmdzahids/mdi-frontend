import { useState, useRef, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { ScanIcon, CameraIcon } from './Icons'
import ScanFeedbackBanner from './ScanFeedbackBanner'

export default function BarcodeScannerBar() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const inputRef = useRef(null)

  const processUniversalBarcode = useProduction1Store((s) => s.processUniversalBarcode)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const handleAction = () => {
    if (barcodeInput.trim()) {
      processUniversalBarcode(barcodeInput)
      setBarcodeInput('')
    } else {
      openCameraScanner({ mode: 'UNIVERSAL', title: 'Scanner QR Kamera' })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleAction()
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const hasText = Boolean(barcodeInput.trim())

  return (
    <div className="w-full">
      <div className="px-3.5 pb-2.5 pt-0.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan atau ketik kode barcode..."
              className="w-full h-11 text-xs tabular-nums pl-3.5 pr-2.5 rounded-xl border-[1.5px] border-[#B7C3CE] bg-white text-[#2C3E50] placeholder-[#6B7B8D] transition-colors focus:border-[#4685ac] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 shadow-2xs"
            />
          </div>

          {/* 1 Tombol Multifungsi Bersih: Jika ada teks -> Proses, Jika kosong -> Buka Kamera */}
          <button
            type="button"
            onClick={handleAction}
            className="h-11 px-4 bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shrink-0 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] focus-visible:ring-offset-2"
          >
            {hasText ? <ScanIcon className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />}
            <span>{hasText ? 'Proses' : 'Kamera'}</span>
          </button>
        </form>
      </div>

      {/* Banner Hasil Scan Semantik Besar dengan Tombol Undo 15s */}
      <ScanFeedbackBanner />
    </div>
  )
}


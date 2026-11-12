import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Scan,
  Camera,
  Check,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Clock,
  Printer,
  ShoppingBag,
  Loader2,
  ArrowRight,
  ShieldAlert
} from 'lucide-react'
import { apiPost } from '../../utils/api'
import { playSuccessBeep, playErrorBeep, playOrderCompleteChime } from '../../utils/soundFx'
import POSCameraScannerModal from './POSCameraScannerModal'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

export default function POSPostPaymentScanModal({
  isOpen,
  onClose,
  paidOrderInfo,
  cartItems,
  onUpdateCartItems,
  onFinalizeComplete,
  onSaveToQueue,
  isSubmitting
}) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [scanFeedback, setScanFeedback] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const totalItems = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
  const totalScanned = cartItems.reduce(
    (acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0),
    0
  )
  const isComplete = totalScanned >= totalItems && totalItems > 0
  const progressPercent = Math.min(100, Math.round((totalScanned / (totalItems || 1)) * 100))

  const handleScanCode = async (code) => {
    const clean = (code || '').trim().toUpperCase()
    if (!clean) return

    // Cegah scan ganda dalam transaksi ini
    const isAlreadyScanned = cartItems.some((it) =>
      (it.scanned_lots || []).includes(clean)
    )
    if (isAlreadyScanned) {
      playErrorBeep()
      setScanFeedback({
        type: 'error',
        text: `Kode '${clean}' sudah di-scan di pesanan ini`
      })
      setBarcodeInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    setIsScanning(true)
    setScanFeedback(null)

    try {
      // 1. Validasi kemasan fisik ke backend
      const res = await apiPost('/pos/scan-lot', { lot_qr_code: clean })

      // 2. Cocokkan dengan item pesanan yang masih membutuhkan scan
      const targetIndex = cartItems.findIndex(
        (it) =>
          it.product_id === res.product_id &&
          (it.scanned_lots || []).length < it.qty
      )

      if (targetIndex < 0) {
        // Produk ada di pesanan tapi sudah penuh, atau produk tidak ada dalam pesanan
        const isProductInCart = cartItems.some((it) => it.product_id === res.product_id)
        playErrorBeep()
        if (isProductInCart) {
          setScanFeedback({
            type: 'error',
            text: `Kuota kemasan '${res.product_name}' sudah terpenuhi lengkap`
          })
        } else {
          setScanFeedback({
            type: 'error',
            text: `'${clean}' adalah '${res.product_name}', tidak ada dalam pesanan ini`
          })
        }
        setBarcodeInput('')
        return
      }

      // 3. Tambahkan lot ke item tersebut
      const updated = [...cartItems]
      const currentLots = updated[targetIndex].scanned_lots || []
      updated[targetIndex] = {
        ...updated[targetIndex],
        scanned_lots: [...currentLots, clean]
      }

      onUpdateCartItems(updated)

      const newTotalScanned = totalScanned + 1
      if (newTotalScanned >= totalItems) {
        playOrderCompleteChime()
        setScanFeedback({
          type: 'success',
          text: `✓ Lengkap! ${res.product_name} (${clean}) terscan`
        })
      } else {
        playSuccessBeep()
        setScanFeedback({
          type: 'success',
          text: `✓ ${res.product_name} (${clean}) terscan (${newTotalScanned}/${totalItems})`
        })
      }

      setBarcodeInput('')
    } catch (err) {
      playErrorBeep()
      setScanFeedback({
        type: 'error',
        text: err?.message || `'${clean}' tidak valid atau sudah terjual`
      })
      setBarcodeInput('')
    } finally {
      setIsScanning(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleRemoveLot = (productId, lotCode) => {
    playErrorBeep()
    const updated = cartItems.map((it) => {
      if (it.product_id !== productId) return it
      return {
        ...it,
        scanned_lots: (it.scanned_lots || []).filter((c) => c !== lotCode)
      }
    })
    onUpdateCartItems(updated)
    setScanFeedback({
      type: 'info',
      text: `'${lotCode}' dilepas`
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSkipScan = () => {
    const confirmSkip = window.confirm(
      `Perhatian: Baru ${totalScanned} dari ${totalItems} kemasan yang discan.\n\nApakah Anda yakin ingin menyelesaikan transaksi tanpa merekam kode fisik kemasan?`
    )
    if (confirmSkip) {
      onFinalizeComplete()
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ type: 'spring', damping: 25, stiffness: 340 }}
          className="relative w-full max-w-xl z-10 flex flex-col bg-white border border-[#EDE8DF] shadow-2xl rounded-2xl overflow-hidden max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#EDE8DF] bg-[#F5F1EB] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2F7D5B] text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-extrabold text-[#2C3E50] font-heading block">
                      Scan Out Kemasan Fisik
                    </span>
                    <span className="text-[10px] font-bold text-[#2F7D5B] bg-[#E8F5E9] border border-[#C8E6C9] px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Lunas ({paidOrderInfo?.method || 'PAID'})
                    </span>
                  </div>
                  <span className="text-xs text-[#6B7B8D] mt-0.5 block">
                    Pelanggan: <strong>{paidOrderInfo?.customerName || 'Walk-in'}</strong> · Total: {formatRupiah(paidOrderInfo?.amountPaid || paidOrderInfo?.totalAmount)}
                  </span>
                </div>
              </div>

              {onSaveToQueue && (
                <button
                  type="button"
                  onClick={onSaveToQueue}
                  className="h-8 px-2.5 rounded-lg bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#3A6B80] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Simpan pesanan ke antrean agar bisa discan nanti"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Simpan ke Antrean</span>
                  <span className="sm:hidden">Antrean</span>
                </button>
              )}
            </div>

            {/* Instruction banner */}
            <p className="text-[11px] text-[#556575] bg-white/70 border border-[#EDE8DF] rounded-lg p-2 leading-relaxed">
              Pembayaran telah terverifikasi. Ambil kemasan dari freezer / rak penyimpanan, lalu tembak barcode fisik kemasan dengan scanner untuk memotong stok resmi pabrik.
            </p>

            {/* Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#2C3E50]">
                  Progres Scan Kemasan:
                </span>
                <span className={`font-black tabular-nums ${isComplete ? 'text-[#2F7D5B]' : 'text-[#3A6B80]'}`}>
                  {totalScanned} dari {totalItems} Pack ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-white border border-[#EDE8DF] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isComplete ? 'bg-[#2F7D5B]' : 'bg-[#3A6B80]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[50vh]">
            {/* Barcode Scanner Input Box */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Scan className="w-4 h-4 text-[#6B7B8D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleScanCode(barcodeInput)
                      }
                    }}
                    placeholder="Scan barcode kemasan fisik / ketik kode lot..."
                    disabled={isComplete || isScanning}
                    className="w-full h-11 bg-[#F5F1EB] border-2 border-[#EDE8DF] focus:border-[#4685ac] focus:bg-white rounded-xl pl-9 pr-3 text-xs sm:text-sm font-semibold text-[#2C3E50] placeholder:text-[#8C9BA8] focus:outline-none transition-colors disabled:opacity-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={isComplete || isScanning}
                  className="w-11 h-11 rounded-xl bg-white border-2 border-[#EDE8DF] hover:bg-[#F5F1EB] text-[#2C3E50] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 transition-colors"
                  title="Scan pakai kamera webcam / HP"
                >
                  <Camera className="w-5 h-5 text-[#3A6B80]" />
                </button>
              </div>

              {/* Feedback Alert */}
              <AnimatePresence>
                {scanFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between border ${
                      scanFeedback.type === 'success'
                        ? 'bg-[#E8F5E9] text-[#2F7D5B] border-[#C8E6C9]'
                        : scanFeedback.type === 'error'
                          ? 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]'
                          : 'bg-[#E3F2FD] text-[#1976D2] border-[#BBDEFB]'
                    }`}
                  >
                    <span>{scanFeedback.text}</span>
                    <button
                      type="button"
                      onClick={() => setScanFeedback(null)}
                      className="text-xs hover:opacity-70 ml-2 cursor-pointer"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Checklist Produk yang Harus Discan */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider block">
                Daftar Kemasan yang Harus Diserahkan:
              </span>

              <div className="space-y-2">
                {cartItems.map((it) => {
                  const scannedCount = (it.scanned_lots && it.scanned_lots.length) || 0
                  const isItemDone = scannedCount >= it.qty

                  return (
                    <div
                      key={it.product_id}
                      className={`p-3 rounded-xl border transition-colors space-y-2 ${
                        isItemDone
                          ? 'bg-[#E8F5E9]/40 border-[#C8E6C9]'
                          : 'bg-[#F5F1EB] border-[#EDE8DF]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#2C3E50] block">
                            {it.product_name}
                          </span>
                          <span className="text-[10px] text-[#6B7B8D]">
                            {it.spec || ''} · {it.qty} Pack Dibutuhkan
                          </span>
                        </div>

                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border tabular-nums ${
                            isItemDone
                              ? 'bg-[#2F7D5B] text-white border-[#2F7D5B]'
                              : 'bg-white text-[#2C3E50] border-[#EDE8DF]'
                          }`}
                        >
                          {scannedCount} / {it.qty} Pack
                        </span>
                      </div>

                      {/* Scanned Lot Chips */}
                      {scannedCount > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#EDE8DF]">
                          {(it.scanned_lots || []).map((code) => (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#C8E6C9] text-[10px] font-mono font-bold text-[#2F7D5B] shadow-2xs"
                            >
                              <span>{code}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveLot(it.product_id, code)}
                                className="text-[#D32F2F] hover:bg-[#FFEBEE] p-0.5 rounded cursor-pointer"
                                title="Hapus kode kemasan ini"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[#F5F1EB] border-t border-[#EDE8DF] flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSkipScan}
              className="h-10 px-3 rounded-xl bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Lewati scan jika ada kendala fisik pada label barcode"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#E65100]" />
              <span className="hidden sm:inline">Lewati Scan Kemasan</span>
              <span className="sm:hidden">Lewati</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting || (!isComplete && totalScanned === 0)}
              onClick={onFinalizeComplete}
              className={`h-10 px-5 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isComplete
                  ? 'bg-[#2F7D5B] hover:bg-[#256348] ring-2 ring-[#2F7D5B]/30'
                  : 'bg-[#3A6B80] hover:bg-[#2F586B]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Pesanan...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Selesai &amp; Cetak Struk</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Camera Scanner Support */}
        <POSCameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => {
            setIsCameraOpen(false)
            setTimeout(() => inputRef.current?.focus(), 80)
          }}
          onScan={(code) => {
            setIsCameraOpen(false)
            handleScanCode(code)
          }}
        />
      </div>
    </AnimatePresence>
  )
}

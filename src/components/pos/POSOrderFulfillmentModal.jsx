import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Check, Camera, Scan, AlertCircle, Trash2 } from 'lucide-react'
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

export default function POSOrderFulfillmentModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated
}) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen || !order) return null

  const isComplete = order.total_scanned >= order.total_items
  const progressPercent = Math.min(100, Math.round((order.total_scanned / (order.total_items || 1)) * 100))

  const channelColors = {
    SHOPEEFOOD: 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D]',
    WEBSITE: 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]',
    GRABFOOD: 'border-[#00B14F] bg-[#00B14F]/10 text-[#00B14F]',
    GOFOOD: 'border-[#ED2724] bg-[#ED2724]/10 text-[#ED2724]'
  }
  const badgeClass = channelColors[order.channel] || 'border-gray-500 bg-gray-50 text-gray-700'

  const handleScanCode = async (code) => {
    const clean = (code || '').trim().toUpperCase()
    if (!clean) return

    setIsScanning(true)
    setFeedback(null)

    try {
      const res = await apiPost(`/pos/orders/${order.id}/scan-lot`, {
        lot_qr_code: clean
      })

      if (res.is_complete) {
        playOrderCompleteChime()
      } else {
        playSuccessBeep()
      }

      setFeedback({
        type: 'success',
        text: `Terscan: ${clean} (${res.total_scanned}/${res.total_items} pack)`
      })
      setBarcodeInput('')
      if (onOrderUpdated) onOrderUpdated()
    } catch (err) {
      playErrorBeep()
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal scan kemasan.'
      })
    } finally {
      setIsScanning(false)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }

  const handleCompleteOrder = async () => {
    setIsCompleting(true)
    try {
      await apiPost(`/pos/orders/${order.id}/complete`, {})
      playOrderCompleteChime()
      if (onOrderUpdated) onOrderUpdated()
      onClose()
    } catch (err) {
      playErrorBeep()
      setFeedback({ type: 'error', text: err?.message || 'Gagal menyelesaikan pesanan.' })
    } finally {
      setIsCompleting(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!window.confirm(`Batalkan pesanan #${order.order_no}? Seluruh kemasan yang telah terscan akan dikembalikan ke status stok aktif.`)) {
      return
    }

    try {
      await apiPost(`/pos/orders/${order.id}/cancel`, {})
      if (onOrderUpdated) onOrderUpdated()
      onClose()
    } catch (err) {
      alert(err?.message || 'Gagal membatalkan pesanan.')
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
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#EDE8DF] space-y-4.5 z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border ${badgeClass}`}>
                  {order.channel}
                </span>
                <span className="text-sm font-extrabold text-[#2C3E50] font-heading">
                  #{order.order_no}
                </span>
              </div>
              <span className="text-[11px] text-[#556575] block mt-1">
                {order.customer_name || 'Driver Pick-up'} • {formatRupiah(order.total_amount)}
              </span>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F5F1EB] text-[#556575] hover:text-[#2C3E50] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Progress Bar Pemenuhan */}
          <div className="bg-[#F5F1EB] rounded-2xl p-3.5 border border-[#EDE8DF] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#2C3E50] flex items-center gap-1.5">
                <span>Status Pemenuhan Kemasan</span>
                {isComplete && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-[#2F7D5B] text-white text-[10px] font-bold">
                    Lengkap
                  </span>
                )}
              </span>
              <span className="font-extrabold text-[#2C3E50] tabular-nums font-mono">
                {order.total_scanned} / {order.total_items} Pack ({progressPercent}%)
              </span>
            </div>

            {/* Segmented Meter Track */}
            <div className="w-full h-3 rounded-full bg-[#EDE8DF] overflow-hidden p-0.5 border border-[#B7C3CE]/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`h-full rounded-full transition-colors ${
                  isComplete ? 'bg-[#2F7D5B]' : 'bg-[#3A6B80]'
                }`}
              />
            </div>
          </div>

          {/* Scanner Input Cockpit */}
          {!isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-[#556575] uppercase tracking-wider">
                  Tembak Barcode Kemasan
                </span>
                <span className="text-[10px] text-[#2F7D5B] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2F7D5B] animate-pulse" />
                  Scanner Siap
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Scan className="w-5 h-5 text-[#2C3E50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    disabled={isScanning}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleScanCode(barcodeInput)
                      }
                    }}
                    placeholder="Scan lot kemasan dari freezer..."
                    className="w-full h-12 bg-[#F5F1EB] rounded-2xl pl-10 pr-3 font-mono text-sm font-bold uppercase text-[#2C3E50] border border-[#B7C3CE] focus:bg-white focus:outline-none focus:border-[#2F7D5B] transition-colors"
                  />
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setIsCameraOpen(true)}
                  className="w-12 h-12 rounded-2xl bg-[#EEF5F9] border border-[#6A9DB3]/40 text-[#3A6B80] flex items-center justify-center hover:bg-[#D1E4EF] cursor-pointer shrink-0"
                  title="Buka Kamera HP"
                >
                  <Camera className="w-5 h-5 stroke-[2.2]" />
                </motion.button>
              </div>

              {/* Feedback Pill */}
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-[#EAF5EE] text-[#2F7D5B] border border-[#BCE3CF]'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{feedback.text}</span>
                </motion.div>
              )}
            </div>
          )}

          {/* Checklist Target Item */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#556575] uppercase tracking-wider block px-1">
              Daftar Kemasan Diperlukan
            </span>

            <div className="divide-y divide-[#EDE8DF] border border-[#EDE8DF] rounded-2xl bg-white overflow-hidden">
              {order.items?.map((it) => {
                const complete = it.qty_scanned >= it.qty_ordered
                return (
                  <div
                    key={it.id || it.product_id}
                    className={`p-3 flex items-center justify-between text-xs transition-colors ${
                      complete ? 'bg-[#EAF5EE]/50' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className={`font-bold block truncate ${complete ? 'text-[#2F7D5B]' : 'text-[#2C3E50]'}`}>
                        {it.product_name}
                      </span>
                      <span className="text-[11px] text-[#556575]">
                        {formatRupiah(it.unit_price)} per pack
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg tabular-nums ${
                          complete
                            ? 'bg-[#2F7D5B] text-white'
                            : 'bg-[#EDE8DF] text-[#2C3E50]'
                        }`}
                      >
                        {it.qty_scanned} / {it.qty_ordered} pack
                      </span>
                      {complete && <Check className="w-4 h-4 text-[#2F7D5B] stroke-[3]" />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Kemasan yang telah terscan */}
          {order.scanned_lots?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#556575] uppercase tracking-wider block px-1">
                Kemasan Fisik Terverifikasi ({order.scanned_lots.length})
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {order.scanned_lots.map((l) => (
                  <div
                    key={l.id || l.lot_qr_code}
                    className="p-2 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="w-3.5 h-3.5 text-[#2F7D5B] shrink-0" />
                      <span className="font-mono font-bold text-[#2C3E50] truncate">
                        {l.lot_qr_code}
                      </span>
                      <span className="text-[10px] text-[#556575] truncate">
                        ({l.product_name})
                      </span>
                    </div>
                    <span className="text-[10px] text-[#6B7B8D] font-mono shrink-0">
                      {l.scanned_at ? new Date(l.scanned_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'OK'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2 border-t border-[#EDE8DF]">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleCancelOrder}
              className="h-12 px-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Batal</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={!isComplete || isCompleting}
              onClick={handleCompleteOrder}
              className={`flex-1 h-12 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                isComplete
                  ? 'bg-[#2F7D5B] hover:bg-[#27664B] text-white active:scale-98'
                  : 'bg-[#EDE8DF] text-[#6B7B8D] cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isCompleting ? 'Menyimpan...' : 'Serahkan ke Driver & Selesai'}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Fallback Camera Modal */}
        <POSCameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={async (scannedCode) => {
            await handleScanCode(scannedCode)
          }}
          title={`Scan Lot #${order.order_no}`}
        />
      </div>
    </AnimatePresence>
  )
}

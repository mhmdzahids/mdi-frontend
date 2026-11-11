import { useState, useRef, useEffect } from 'react'
import { X, Check, Camera, Scan, AlertCircle } from 'lucide-react'
import { apiPost } from '../../utils/api'
import { playSuccessBeep, playErrorBeep } from '../../utils/soundFx'
import POSCameraScannerModal from './POSCameraScannerModal'

export default function POSOrderFulfillmentModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated
}) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'error', text: '' }
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

  const handleScanCode = async (code) => {
    const clean = (code || '').trim().toUpperCase()
    if (!clean) return

    setIsScanning(true)
    setFeedback(null)

    try {
      const res = await apiPost(`/pos/orders/${order.id}/scan-lot`, {
        lot_qr_code: clean
      })

      playSuccessBeep()
      setFeedback({
        type: 'success',
        text: `Terscan: ${clean} (${res.total_scanned}/${res.total_items})`
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
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleCompleteOrder = async () => {
    setIsCompleting(true)
    try {
      await apiPost(`/pos/orders/${order.id}/complete`, {})
      playSuccessBeep()
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
    if (!window.confirm(`Batalkan pesanan #${order.order_no}? Seluruh kemasan yang terscan akan dikembalikan ke stok.`)) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3.5 select-none">
      <div className="w-full max-w-lg bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-[#EDE8DF] space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#2C3E50] text-white">
                {order.channel}
              </span>
              <span className="text-base font-bold text-[#2C3E50]">#{order.order_no}</span>
            </div>
            <span className="text-xs text-[#6B7B8D] block mt-0.5">
              {order.customer_name || 'Driver / Pemesan'} • {order.total_scanned}/{order.total_items} pack
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F5F1EB] text-[#2C3E50] flex items-center justify-center hover:bg-[#EDE8DF] active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan Barcode Field (Support Gun Scanner) */}
        {!isComplete ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#6B7B8D] block">Scan Kemasan Fisik</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Scan className="w-4 h-4 text-[#6B7B8D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  disabled={isScanning}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleScanCode(barcodeInput)
                    }
                  }}
                  placeholder={isScanning ? 'Memproses scan...' : 'Scan barcode kemasan...'}
                  className="w-full h-12 bg-white border border-[#B7C3CE] rounded-xl pl-9 pr-3 text-xs font-bold uppercase text-[#2C3E50] focus:outline-none focus:border-[#4685ac] disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="w-12 h-12 rounded-xl bg-[#EEF5F9] border border-[#6A9DB3]/40 text-[#3A6B80] flex items-center justify-center hover:bg-[#D1E4EF] active:scale-95 cursor-pointer shrink-0"
                title="Buka Kamera"
              >
                <Camera className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#2F7D5B]/10 border border-[#2F7D5B] rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2F7D5B] text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#2F7D5B] block">Kemasan Lengkap ({order.total_scanned}/{order.total_items})</span>
              <span className="text-[11px] text-[#6B7B8D]">Pesanan siap diserahkan ke driver / kurir.</span>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-[#2F7D5B]/10 text-[#2F7D5B] border border-[#2F7D5B]/30'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Checklist Kemasan Pesanan */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#6B7B8D] block">Daftar Kemasan yang Diperlukan</span>
          <div className="space-y-2">
            {order.items?.map((it) => {
              const full = it.qty_scanned >= it.qty_ordered
              return (
                <div
                  key={it.id || it.product_id}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    full ? 'bg-[#2F7D5B]/5 border-[#2F7D5B]/30' : 'bg-[#F5F1EB] border-[#EDE8DF]'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-[#2C3E50] block">{it.product_name}</span>
                    <span className="text-[11px] text-[#6B7B8D]">
                      {it.qty_scanned} dari {it.qty_ordered} pack
                    </span>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg tabular-nums ${
                      full
                        ? 'bg-[#2F7D5B] text-white'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {it.qty_scanned}/{it.qty_ordered}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Scanned Lot Codes Chips */}
        {order.scanned_lots?.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-[#6B7B8D] block">
              Barcode Terkunci ({order.scanned_lots.length}):
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-[#F5F1EB] rounded-xl border border-[#EDE8DF]">
              {order.scanned_lots.map((sl) => (
                <span
                  key={sl.lot_qr_code}
                  className="text-[10px] font-mono font-semibold bg-white border border-[#EDE8DF] text-[#2C3E50] px-2 py-0.5 rounded-md"
                >
                  {sl.lot_qr_code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelOrder}
            className="h-12 px-3 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 active:scale-95 transition-all"
          >
            Batalkan
          </button>

          <button
            type="button"
            disabled={!isComplete || isCompleting}
            onClick={handleCompleteOrder}
            className="flex-1 h-12 bg-[#2F7D5B] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-[#27664B] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isCompleting ? 'Menyerahkan...' : 'Serahkan ke Driver'}</span>
          </button>
        </div>
      </div>

      {/* Embedded Camera Scanner */}
      <POSCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={async (scannedCode) => {
          await handleScanCode(scannedCode)
          if (order.total_scanned + 1 >= order.total_items) {
            setIsCameraOpen(false)
          }
        }}
        title={`Scan Pack #${order.order_no}`}
      />
    </div>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Check, Banknote, QrCode, Building } from 'lucide-react'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

export default function POSPaymentDrawer({
  isOpen,
  onClose,
  totalAmount,
  totalItems,
  onConfirmCheckout,
  isSubmitting
}) {
  const [paymentMethod, setPaymentMethod] = useState('CASH') // CASH | QRIS | TRANSFER
  const [customerName, setCustomerName] = useState('Walk-in')
  const [customPaid, setCustomPaid] = useState(null)

  if (!isOpen) return null

  const amountPaid = customPaid !== null ? customPaid : totalAmount
  const change = Math.max(0, (amountPaid || 0) - totalAmount)
  const isUnderpaid = paymentMethod === 'CASH' && (amountPaid || 0) < totalAmount

  const handleQuickCash = (val) => {
    setCustomPaid(val)
  }

  const handleClose = () => {
    setCustomPaid(null)
    setPaymentMethod('CASH')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isUnderpaid) return

    onConfirmCheckout({
      paymentMethod,
      customerName: customerName.trim() || 'Walk-in',
      amountPaid: paymentMethod === 'CASH' ? amountPaid : totalAmount
    })
    setCustomPaid(null)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs select-none">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-[#EDE8DF] max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3 mb-4">
            <div>
              <span className="text-xs font-bold text-[#6B7B8D] block">Total Pembayaran</span>
              <span className="text-2xl font-bold font-heading text-[#2C3E50] tabular-nums block">
                {formatRupiah(totalAmount)}
              </span>
              <span className="text-[11px] text-[#6B7B8D]">{totalItems} pack dimsum</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-[#F5F1EB] text-[#2C3E50] flex items-center justify-center hover:bg-[#EDE8DF] active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Metoda Pembayaran */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6B7B8D] block">Metode Pembayaran</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Tunai', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'TRANSFER', label: 'Transfer', icon: Building }
                ].map((m) => {
                  const Icon = m.icon
                  const active = paymentMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id)
                        if (m.id !== 'CASH') setCustomPaid(null)
                      }}
                      className={`h-12 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-98 cursor-pointer ${
                        active
                          ? 'border-[#2F7D5B] bg-[#2F7D5B]/10 text-[#2F7D5B] ring-1 ring-[#2F7D5B]'
                          : 'border-[#EDE8DF] bg-[#F5F1EB] text-[#2C3E50] hover:bg-[#EDE8DF]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bagian Uang Tunai & Kembalian */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6B7B8D] block">Uang Diterima</label>
                  <input
                    type="number"
                    value={amountPaid || ''}
                    onChange={(e) => setCustomPaid(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full h-12 bg-white border border-[#B7C3CE] rounded-xl px-3 font-bold text-lg tabular-nums text-[#2C3E50] focus:outline-none focus:border-[#2F7D5B]"
                  />
                </div>

                {/* Quick Cash Chips */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(totalAmount)}
                    className="h-10 rounded-lg bg-white border border-[#EDE8DF] text-[11px] font-bold text-[#2C3E50] hover:bg-[#EDE8DF] active:scale-95"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 200000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickCash(val)}
                      className="h-10 rounded-lg bg-white border border-[#EDE8DF] text-[11px] font-bold text-[#2C3E50] hover:bg-[#EDE8DF] active:scale-95 tabular-nums"
                    >
                      {(val / 1000).toLocaleString('id-ID')}rb
                    </button>
                  ))}
                </div>

                {/* Kembalian Banner */}
                <div className="flex items-center justify-between pt-1 border-t border-[#EDE8DF]">
                  <span className="text-xs font-semibold text-[#6B7B8D]">Kembalian:</span>
                  <span
                    className={`text-base font-bold tabular-nums ${
                      isUnderpaid ? 'text-rose-600' : 'text-[#2F7D5B]'
                    }`}
                  >
                    {isUnderpaid ? `Kurang ${formatRupiah(totalAmount - amountPaid)}` : formatRupiah(change)}
                  </span>
                </div>
              </div>
            )}

            {/* Nama Pelanggan (Opsional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6B7B8D] block">Nama Pembeli (Opsional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in"
                className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl px-3 text-sm text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
              />
            </div>

            {/* Tombol Simpan Transaksi */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isUnderpaid}
                className="w-full h-13 rounded-xl bg-[#2F7D5B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-[#27664B] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Bayar & Selesai'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

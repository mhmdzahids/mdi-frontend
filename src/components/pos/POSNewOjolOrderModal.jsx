import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Plus, Minus, ShoppingBag, Bike } from 'lucide-react'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

const CHANNELS = [
  {
    id: 'SHOPEEFOOD',
    label: 'ShopeeFood',
    prefix: 'SPF-',
    theme: 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D]',
    activeBorder: 'border-[#EE4D2D] ring-2 ring-[#EE4D2D]/30 bg-[#EE4D2D]/15 text-[#EE4D2D]'
  },
  {
    id: 'GRABFOOD',
    label: 'GrabFood',
    prefix: 'GRB-',
    theme: 'border-[#00B14F] bg-[#00B14F]/10 text-[#00B14F]',
    activeBorder: 'border-[#00B14F] ring-2 ring-[#00B14F]/30 bg-[#00B14F]/15 text-[#00B14F]'
  },
  {
    id: 'GOFOOD',
    label: 'GoFood',
    prefix: 'GF-',
    theme: 'border-[#ED2724] bg-[#ED2724]/10 text-[#ED2724]',
    activeBorder: 'border-[#ED2724] ring-2 ring-[#ED2724]/30 bg-[#ED2724]/15 text-[#ED2724]'
  }
]

export default function POSNewOjolOrderModal({
  isOpen,
  onClose,
  products = [],
  onSubmit,
  isSubmitting
}) {
  const [channel, setChannel] = useState('SHOPEEFOOD')
  const [orderNo, setOrderNo] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [itemQtys, setItemQtys] = useState({})

  if (!isOpen) return null

  const selectedChannel = CHANNELS.find((c) => c.id === channel) || CHANNELS[0]

  const handleQtyChange = (productId, delta) => {
    setItemQtys((prev) => {
      const current = prev[productId] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [productId]: next }
    })
  }

  const handleApplyPrefix = (prefix) => {
    if (!orderNo.startsWith(prefix)) {
      setOrderNo(prefix)
    }
  }

  const totalPacks = Object.values(itemQtys).reduce((a, b) => a + b, 0)
  const totalAmount = products.reduce((acc, p) => {
    const qty = itemQtys[p.id] || 0
    return acc + qty * (p.price || 0)
  }, 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!orderNo.trim()) {
      alert('Masukkan nomor pesanan atau resi driver.')
      return
    }

    const items = []
    products.forEach((p) => {
      const q = itemQtys[p.id] || 0
      if (q > 0) {
        items.push({
          product_id: p.id,
          product_name: p.name,
          qty: q,
          price: p.price || 0
        })
      }
    })

    if (items.length === 0) {
      alert('Pilih minimal 1 kemasan produk.')
      return
    }

    onSubmit({
      order_no: orderNo.trim().toUpperCase(),
      channel,
      customer_name: customerName.trim() || undefined,
      items
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 select-none">
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
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#EDE8DF] space-y-4.5 z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50]">
                <Bike className="w-5 h-5 text-[#3A6B80]" />
              </div>
              <span className="text-sm font-bold text-[#2C3E50] font-heading block">
                Pesanan Ojol
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

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Platform Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#556575] uppercase tracking-wider block">
                Platform
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((c) => {
                  const active = channel === c.id
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setChannel(c.id)
                        handleApplyPrefix(c.prefix)
                      }}
                      className={`h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        active
                          ? c.activeBorder
                          : 'border-[#EDE8DF] bg-[#F5F1EB]/50 text-[#556575] hover:bg-[#F5F1EB]'
                      }`}
                    >
                      <span className="text-[12px] font-extrabold">{c.label}</span>
                      <span className="text-[9px] opacity-75 font-mono">{c.prefix}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Nomor Pesanan / Order ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#556575] uppercase tracking-wider block">
                  No. Order / Resi <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleApplyPrefix(selectedChannel.prefix)}
                  className="text-[10px] font-bold text-[#3A6B80] hover:underline"
                >
                  {selectedChannel.prefix}
                </button>
              </div>
              <input
                type="text"
                required
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
                placeholder={`Contoh: ${selectedChannel.prefix}8821`}
                className="w-full h-11 bg-[#F5F1EB] rounded-xl px-3.5 text-xs font-mono font-bold uppercase text-[#2C3E50] border border-[#B7C3CE] focus:bg-white focus:outline-none focus:border-[#3A6B80] transition-colors"
              />
            </div>

            {/* Nama Driver / Catatan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#556575] uppercase tracking-wider block">
                Driver / Pemesan (Opsional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama driver atau catatan..."
                className="w-full h-11 bg-[#F5F1EB] rounded-xl px-3.5 text-xs text-[#2C3E50] border border-[#B7C3CE] focus:bg-white focus:outline-none focus:border-[#3A6B80] transition-colors"
              />
            </div>

            {/* Daftar Produk Kemasan */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#556575] uppercase tracking-wider block">
                  Pilih Produk
                </label>
                <span className="text-[11px] font-bold text-[#3A6B80] tabular-nums">
                  {totalPacks} pack
                </span>
              </div>

              <div className="divide-y divide-[#EDE8DF] border border-[#EDE8DF] rounded-2xl bg-white overflow-hidden">
                {products.map((p) => {
                  const qty = itemQtys[p.id] || 0
                  return (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[#F5F1EB]/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#2C3E50] block truncate">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-[#556575]">
                          <span>{p.spec || 'Pack'}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#2F7D5B] tabular-nums">
                            {formatRupiah(p.price)}
                          </span>
                        </div>
                      </div>

                      {/* Stepper +/- */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-[#F5F1EB] rounded-xl p-1 border border-[#EDE8DF]">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          onClick={() => handleQtyChange(p.id, -1)}
                          disabled={qty <= 0}
                          className="w-7 h-7 rounded-lg bg-white border border-[#EDE8DF] text-[#2C3E50] flex items-center justify-center disabled:opacity-30 cursor-pointer shadow-2xs"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </motion.button>
                        <span className="w-7 text-center text-xs font-extrabold text-[#2C3E50] tabular-nums">
                          {qty}
                        </span>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          onClick={() => handleQtyChange(p.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#2C3E50] text-white flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Total Footer Banner */}
            <div className="bg-[#2C3E50] rounded-2xl p-3 text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#B7C3CE] block">
                  TOTAL
                </span>
                <span className="text-xs font-medium text-white/80">
                  {totalPacks} pack
                </span>
              </div>
              <span className="text-xl font-extrabold font-heading text-white tabular-nums">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            {/* Tombol Submit */}
            <div className="pt-1 flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="h-11 px-4 rounded-xl border border-[#EDE8DF] bg-white text-[#556575] hover:text-[#2C3E50] text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </motion.button>

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                disabled={!orderNo.trim() || totalPacks === 0 || isSubmitting}
                className="flex-1 h-11 rounded-xl bg-[#3A6B80] hover:bg-[#2F586B] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Order'}</span>
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'

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

  const handleQtyChange = (productId, delta) => {
    setItemQtys((prev) => {
      const current = prev[productId] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [productId]: next }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!orderNo.trim()) return

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
      alert('Pilih minimal 1 item untuk pesanan ini.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-[#EDE8DF] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3">
          <div>
            <span className="text-sm font-bold text-[#2C3E50] block">Pesanan Ojek Online</span>
            <span className="text-[11px] text-[#6B7B8D]">Input order untuk antrean scan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F5F1EB] text-[#2C3E50] flex items-center justify-center hover:bg-[#EDE8DF] active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#6B7B8D] block">Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'SHOPEEFOOD', label: 'ShopeeFood', color: 'border-orange-500 text-orange-600 bg-orange-50' },
                { id: 'GRABFOOD', label: 'GrabFood', color: 'border-emerald-600 text-emerald-600 bg-emerald-50' },
                { id: 'GOFOOD', label: 'GoFood', color: 'border-red-500 text-red-600 bg-red-50' }
              ].map((c) => {
                const active = channel === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`h-11 rounded-xl border text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                      active
                        ? `${c.color} ring-1`
                        : 'border-[#EDE8DF] bg-[#F5F1EB] text-[#6B7B8D] hover:bg-[#EDE8DF]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* No. Order & Nama Customer */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6B7B8D] block">No. Order / PIN *</label>
              <input
                type="text"
                required
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="SPF-8821"
                className="w-full h-11 bg-white border border-[#B7C3CE] rounded-xl px-3 text-xs font-bold uppercase text-[#2C3E50] focus:outline-none focus:border-[#4685ac]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#6B7B8D] block">Pemesan</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pemesan"
                className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl px-3 text-xs text-[#2C3E50] focus:outline-none focus:border-[#4685ac]"
              />
            </div>
          </div>

          {/* Item Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#6B7B8D] block">Pilih Jumlah Item</label>
            <div className="space-y-2">
              {products.map((p) => {
                const qty = itemQtys[p.id] || 0
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#2C3E50] block">{p.name}</span>
                      <span className="text-[10px] text-[#6B7B8D]">{p.spec || 'Pack'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => handleQtyChange(p.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white border border-[#EDE8DF] flex items-center justify-center text-[#2C3E50] disabled:opacity-30 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold tabular-nums text-[#2C3E50]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(p.id, 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-[#EDE8DF] flex items-center justify-center text-[#2C3E50] active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !orderNo.trim()}
            className="w-full h-12 bg-[#2F7D5B] text-white rounded-xl text-xs font-bold flex items-center justify-center shadow-md hover:bg-[#27664B] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {isSubmitting ? 'Menyimpan...' : 'Masuk Antrean Scan'}
          </button>
        </form>
      </div>
    </div>
  )
}

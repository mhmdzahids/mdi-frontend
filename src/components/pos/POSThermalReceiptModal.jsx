import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Printer, Check, X, Share2, Receipt } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

function formatDate(dateStr) {
  if (!dateStr) {
    return new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB'
  }
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

export default function POSThermalReceiptModal({
  isOpen,
  onClose,
  order
}) {
  const receiptRef = useRef(null)

  if (!isOpen || !order) return null

  const items = order.items || []
  const scannedLots = order.scanned_lots || []
  const totalAmount = order.total_amount || 0
  const amountPaid = order.amount_paid !== undefined ? order.amount_paid : totalAmount
  const change = Math.max(0, amountPaid - totalAmount)

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    const text = `🥟 *STRUK RESMI PABRIK DIMSUM MDI*\nNo: #${order.order_no}\nTanggal: ${formatDate(order.completed_at || order.created_at)}\nKasir: ${order.cashier_name || 'Kasir'}\nTotal: ${formatRupiah(totalAmount)}\nBayar: ${formatRupiah(amountPaid)} (${order.payment_method})\nKembalian: ${formatRupiah(change)}\nTerima kasih!`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Struk Dimsum #${order.order_no}`,
          text
        })
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(text)
      alert('Teks struk berhasil disalin ke clipboard!')
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

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-sm z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header Action Bar */}
          <div className="flex items-center justify-between pb-2 px-1 text-white">
            <div className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#BCE3CF]" />
              <span className="text-xs font-bold font-heading tracking-wide">STRUK KASIR DIGITAL</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Thermal Receipt Paper Card */}
          <div
            ref={receiptRef}
            className="bg-[#FCFAF7] border-x border-t border-[#EDE8DF] shadow-2xl rounded-t-2xl p-5 overflow-y-auto text-[#2C3E50] font-mono text-xs relative select-text"
            style={{
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)'
            }}
          >
            {/* Store Branding */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-[#B7C3CE]">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#2C3E50] text-white text-lg mb-1">
                🥟
              </div>
              <h2 className="text-sm font-extrabold font-heading tracking-tight uppercase text-[#2C3E50]">
                PABRIK DIMSUM MDI
              </h2>
              <p className="text-[10px] text-[#556575] leading-tight">
                Factory Outlet & Traceability POS
              </p>
              <p className="text-[9px] text-[#6B7B8D]">
                Jl. Raya Industri Dimsum No. 8 • Telp 0812-3456-7890
              </p>
            </div>

            {/* Meta Info */}
            <div className="py-2.5 border-b border-dashed border-[#B7C3CE] space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#556575]">No. Struk</span>
                <span className="font-bold text-[#2C3E50]">#{order.order_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#556575]">Waktu</span>
                <span className="font-medium text-[#2C3E50]">{formatDate(order.completed_at || order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#556575]">Kasir</span>
                <span className="font-medium text-[#2C3E50]">{order.cashier_name || 'Kasir 01'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#556575]">Saluran</span>
                <span className="font-bold text-[#3A6B80]">{order.channel || 'OFFLINE'}</span>
              </div>
              {order.customer_name && (
                <div className="flex justify-between">
                  <span className="text-[#556575]">Pelanggan</span>
                  <span className="font-medium text-[#2C3E50]">{order.customer_name}</span>
                </div>
              )}
            </div>

            {/* Itemized Products */}
            <div className="py-3 border-b border-dashed border-[#B7C3CE] space-y-2.5">
              <div className="flex justify-between text-[10px] font-bold text-[#556575] uppercase tracking-wider">
                <span>Item</span>
                <span>Total</span>
              </div>

              {items.map((it, idx) => {
                const qty = it.qty_ordered || it.qty || 1
                const price = it.unit_price || it.price || 0
                const subtotal = it.subtotal || (qty * price)

                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-xs font-bold text-[#2C3E50]">
                      <span>{it.product_name}</span>
                      <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#556575]">
                      <span>{qty} pack x {formatRupiah(price)}</span>
                    </div>
                  </div>
                )
              })}

              {/* Scanned Pack QR list (Traceability Footprint) */}
              {scannedLots.length > 0 && (
                <div className="pt-2 mt-2 border-t border-dotted border-[#EDE8DF]">
                  <span className="text-[9px] font-bold text-[#556575] uppercase block mb-1">
                    Traceability Lot ID ({scannedLots.length} kemasan):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {scannedLots.map((l, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-mono bg-[#EDE8DF] text-[#2C3E50] px-1.5 py-0.5 rounded"
                      >
                        {l.lot_qr_code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="py-3 border-b border-dashed border-[#B7C3CE] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#556575]">
                <span>Total Item</span>
                <span className="font-bold text-[#2C3E50] tabular-nums">{order.total_items || items.length} pack</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[#2C3E50] pt-1">
                <span>TOTAL BELANJA</span>
                <span className="tabular-nums text-[#2F7D5B]">{formatRupiah(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#556575] pt-1">
                <span>Metode Bayar</span>
                <span className="font-bold text-[#2C3E50]">{order.payment_method || 'CASH'}</span>
              </div>
              <div className="flex justify-between text-[#556575]">
                <span>Uang Diterima</span>
                <span className="font-bold text-[#2C3E50] tabular-nums">{formatRupiah(amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#2C3E50] pt-1 border-t border-dotted border-[#EDE8DF]">
                <span>KEMBALIAN</span>
                <span className="tabular-nums text-[#2F7D5B] font-extrabold">{formatRupiah(change)}</span>
              </div>
            </div>

            {/* QR Code & Closing Message */}
            <div className="pt-4 pb-2 text-center space-y-2">
              <div className="inline-block p-2 bg-white rounded-xl border border-[#EDE8DF] shadow-2xs">
                <QRCodeSVG
                  value={`MDI-ORDER:${order.order_no}|TOT:${totalAmount}|DATE:${order.completed_at || order.created_at}`}
                  size={84}
                  level="M"
                />
              </div>
              <div className="text-[10px] text-[#556575] space-y-0.5">
                <p className="font-bold text-[#2C3E50]">Terima kasih atas kunjungan Anda!</p>
                <p>Simpan struk ini sebagai bukti pembelian sah.</p>
                <p className="text-[9px] text-[#6B7B8D] pt-1">Layanan Konsumen: halo@dimsum-mdi.co.id</p>
              </div>
            </div>
          </div>

          {/* Jagged / Sawtooth Receipt Edge Footer */}
          <div
            className="w-full h-4 bg-[#FCFAF7] border-x border-b border-[#EDE8DF] rounded-b-xl relative overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 0, transparent 4px, #FCFAF7 5px)',
              backgroundSize: '12px 8px',
              backgroundRepeat: 'repeat-x',
              backgroundPosition: '0 0'
            }}
          />

          {/* Modal Action Buttons */}
          <div className="pt-3 grid grid-cols-3 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className="h-11 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="h-11 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="h-11 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Selesai</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

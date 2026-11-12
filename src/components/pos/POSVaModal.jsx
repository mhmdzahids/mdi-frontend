import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Building2,
  X,
  Copy,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'
import { useProduction1Store } from '../../store/production1Store'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

function sanitizeExternalUrl(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return null
}

const BANK_NAMES = {
  BCAVA: 'BCA Virtual Account',
  BNIVA: 'BNI Virtual Account',
  BRIVA: 'BRI Virtual Account',
  MANDIRIVA: 'Mandiri Virtual Account',
  PERMATAVA: 'Permata Virtual Account',
  CIMBVA: 'CIMB Niaga Virtual Account'
}

export default function POSVaModal({
  isOpen,
  onClose,
  totalAmount,
  customerName,
  bankCode,
  vaData,
  isLoading,
  isPaid,
  onCheckStatus,
  onSimulatePay,
  onConfirmComplete,
  isSubmitting
}) {
  const [copied, setCopied] = useState(false)
  const [statusChecking, setStatusChecking] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(3600)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const safePaymentUrl = sanitizeExternalUrl(vaData?.paymentUrl)

  // Countdown timer dari expiresAt
  useEffect(() => {
    if (!isOpen || !vaData?.expiresAt) return

    const updateRemaining = () => {
      const exp = new Date(vaData.expiresAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((exp - now) / 1000))
      setSecondsRemaining(diff)
    }

    updateRemaining()
    const timer = setInterval(updateRemaining, 1000)
    return () => clearInterval(timer)
  }, [isOpen, vaData?.expiresAt])

  const bankTitle = BANK_NAMES[bankCode] || BANK_NAMES[vaData?.paymentMethod] || 'Virtual Account'

  const handleCopyVa = () => {
    if (!vaData?.paymentNumber) return
    navigator.clipboard.writeText(vaData.paymentNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleManualCheck = async () => {
    setStatusChecking(true)
    try {
      await onCheckStatus()
    } finally {
      setStatusChecking(false)
    }
  }

  const formatTimer = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h > 0 ? h + 'j ' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isPaid ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-sm z-10 flex flex-col bg-white border border-[#EDE8DF] shadow-2xl rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#EDE8DF] bg-[#F5F1EB]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2C3E50] text-white flex items-center justify-center shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold font-heading text-[#2C3E50] block">
                    {bankTitle}
                  </span>
                  <span className="text-[10px] text-[#6B7B8D]">
                    Paywuz Payment Gateway (Sandbox)
                  </span>
                </div>
              </div>

              {!isPaid && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] flex items-center justify-center cursor-pointer transition-colors"
                  title="Batal / Ganti Bank"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-5 text-center space-y-4">
              {/* Total Display */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-[#6B7B8D] block">
                  Total Tagihan ({customerName || 'Walk-in'}):
                </span>
                <span className="text-2xl font-black text-[#2C3E50] font-heading tabular-nums block">
                  {formatRupiah(vaData?.totalPayment || totalAmount)}
                </span>
                {vaData?.fee?.totalIdr > 0 && (
                  <span className="text-[10px] text-[#8C9BA8] block">
                    Termasuk biaya transaksi {formatRupiah(vaData.fee.totalIdr)}
                  </span>
                )}
              </div>

              {/* VA Number Card */}
              {isLoading ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-2 bg-[#F5F1EB] rounded-2xl border border-[#EDE8DF]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4685ac]" />
                  <span className="text-xs font-medium text-[#6B7B8D]">
                    Membuat nomor Virtual Account...
                  </span>
                </div>
              ) : vaData ? (
                <div className="space-y-3">
                  {/* Large VA Display Box */}
                  <div className="p-4 bg-[#F5F1EB] rounded-2xl border border-[#EDE8DF] space-y-2 relative">
                    <span className="text-[10px] font-bold text-[#6B7B8D] uppercase tracking-wider block">
                      Nomor Pembayaran Virtual Account
                    </span>

                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl sm:text-2xl font-black text-[#2C3E50] tracking-wider font-mono tabular-nums">
                        {vaData.paymentNumber || 'Menunggu nomor...'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyVa}
                        className="h-8 px-2.5 rounded-lg bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Salin Nomor VA"
                      >
                        {copied ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-[#2F7D5B]" />
                            <span className="text-[#2F7D5B]">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>

                    <span className="text-[11px] text-[#6B7B8D] block">
                      Atas Nama: <strong className="text-[#2C3E50]">Makan Dimsum Indonesia</strong>
                    </span>
                  </div>

                  {/* Status Indicator */}
                  {isPaid ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#2F7D5B] bg-[#E8F5E9] py-2 px-3 rounded-xl border border-[#C8E6C9]">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pembayaran VA Berhasil Diterima (Lunas)</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 text-xs text-[#3A6B80] bg-[#F5F1EB] border border-[#EDE8DF] py-2 px-3 rounded-xl">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4685ac] animate-pulse"></span>
                        <span className="font-semibold text-xs">Menunggu transfer dari pelanggan...</span>
                      </div>
                      {vaData.expiresAt && (
                        <span className="text-[10px] text-[#8C9BA8] block tabular-nums">
                          Batas transfer: {formatTimer(secondsRemaining)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={statusChecking || isPaid}
                      onClick={handleManualCheck}
                      className="h-8 px-2.5 rounded-lg bg-[#F5F1EB] border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${statusChecking ? 'animate-spin' : ''}`} />
                      <span>{statusChecking ? 'Mengecek...' : 'Cek Status'}</span>
                    </button>

                    {safePaymentUrl && (
                      <a
                        href={safePaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-2.5 rounded-lg bg-[#F5F1EB] border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#3A6B80] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Paywuz</span>
                      </a>
                    )}

                    {import.meta.env.DEV && isDevMode && !isPaid && (
                      <button
                        type="button"
                        onClick={onSimulatePay}
                        className="h-8 px-2.5 rounded-lg bg-[#3A6B80] hover:bg-[#2F586B] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Simulasi pembayaran VA sandbox langsung"
                      >
                        <span>Simulasi Bayar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 space-y-2 text-center bg-[#F5F1EB] rounded-2xl border border-[#EDE8DF]">
                  <AlertCircle className="w-7 h-7 text-[#E8352D] mx-auto" />
                  <span className="text-xs text-[#2C3E50] font-semibold block">Gagal memuat Virtual Account</span>
                  <span className="text-[11px] text-[#6B7B8D] block">Periksa koneksi gateway Paywuz.</span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-[#F5F1EB] border-t border-[#EDE8DF] flex items-center gap-2">
              {!isPaid && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Batal & Pilih Bank Lain</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSubmitting || isLoading || !vaData}
                onClick={onConfirmComplete}
                className={`flex-1 h-10 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPaid
                    ? 'bg-[#2F7D5B] hover:bg-[#256348]'
                    : 'bg-[#3A6B80] hover:bg-[#2F586B]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : isPaid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesaikan & Cetak Struk</span>
                  </>
                ) : (
                  <>
                    <span>Verifikasi Manual & Selesai</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

import { X, CheckCircle2, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'

function formatFullWibDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(d) + ' WIB'
  } catch {
    return dateStr
  }
}

export default function AuditDetailModal({ isOpen, onClose, log }) {
  useLockBodyScroll(isOpen)

  if (!isOpen || !log) return null

  const isDenied = log.hasil === 'DENIED' || log.aksi === 'ACCESS_DENIED'

  // Parse JSON data for before and after if available
  let parsedBefore = null
  let parsedAfter = null
  try {
    if (log.data_sebelum) parsedBefore = JSON.parse(log.data_sebelum)
  } catch {
    parsedBefore = log.data_sebelum
  }
  try {
    if (log.data_sesudah) parsedAfter = JSON.parse(log.data_sesudah)
  } catch {
    parsedAfter = log.data_sesudah
  }

  const hasDiff = Boolean(parsedBefore || parsedAfter)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#EDE8DF] overflow-hidden my-auto"
      >
        {/* Header Modal */}
        <div className="px-4 py-3.5 border-b border-[#EDE8DF] flex items-center justify-between bg-[#F5F1EB]/60">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isDenied
                  ? 'bg-[#FDF2F2] text-[#C0392B] border-[#F5C6CB]'
                  : 'bg-[#EEF7F2] text-[#2F7D5B] border-[#BCE3CF]'
              }`}
            >
              {log.aksi}
            </span>
            <span className="text-xs font-bold text-[#2C3E50]">Detail Aktivitas</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF]/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi Detail */}
        <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* Ringkasan */}
          <div>
            <span className="text-[10px] font-semibold text-[#6B7B8D] uppercase tracking-wider block mb-1">
              Ringkasan
            </span>
            <p className="text-xs font-semibold text-[#2C3E50] leading-relaxed bg-[#F5F1EB] p-2.5 rounded-xl border border-[#EDE8DF]">
              {log.ringkasan}
            </p>
          </div>

          {/* Grid Informasi Metadata */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-[#EDE8DF]">
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Waktu Lengkap</span>
              <span className="font-medium text-[#2C3E50]">{formatFullWibDateTime(log.waktu)}</span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-[#EDE8DF]">
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Pelaku</span>
              <span className="font-bold text-[#2C3E50]">@{log.nama_user || 'SYSTEM'}</span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-[#EDE8DF]">
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Status Hasil</span>
              <div className="flex items-center gap-1 font-bold">
                {isDenied ? (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-[#C0392B]" />
                    <span className="text-[#C0392B]">Ditolak (403)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D5B]" />
                    <span className="text-[#2F7D5B]">Sukses</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-[#EDE8DF]">
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">IP Klien</span>
              <span className="font-mono text-xs text-[#2C3E50]">{log.ip || '-'}</span>
            </div>

            {log.objek_tipe && (
              <div className="col-span-2 bg-white p-2.5 rounded-xl border border-[#EDE8DF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Target Objek</span>
                  <span className="font-medium text-[#2C3E50]">{log.objek_tipe}</span>
                </div>
                {log.objek_id && (
                  <span className="font-mono text-xs text-[#6B7B8D] bg-[#F5F1EB] px-2 py-0.5 rounded-md">
                    ID: {log.objek_id}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Perubahan Data Sebelum -> Sesudah (Visual Diff) */}
          {hasDiff && (
            <div className="pt-2 border-t border-[#EDE8DF]">
              <span className="text-[10px] font-semibold text-[#6B7B8D] uppercase tracking-wider block mb-2">
                Perubahan Data
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {/* Sebelum */}
                <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-xl p-2.5">
                  <span className="font-bold text-[#C53030] block mb-1">Sebelum:</span>
                  <pre className="font-mono text-[10px] text-[#742A2A] whitespace-pre-wrap break-all overflow-x-auto">
                    {typeof parsedBefore === 'object'
                      ? JSON.stringify(parsedBefore, null, 2)
                      : String(parsedBefore || '-')}
                  </pre>
                </div>

                {/* Sesudah */}
                <div className="bg-[#F0FFF4] border border-[#C6F6D5] rounded-xl p-2.5">
                  <span className="font-bold text-[#276749] block mb-1">Sesudah:</span>
                  <pre className="font-mono text-[10px] text-[#22543D] whitespace-pre-wrap break-all overflow-x-auto">
                    {typeof parsedAfter === 'object'
                      ? JSON.stringify(parsedAfter, null, 2)
                      : String(parsedAfter || '-')}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#EDE8DF] bg-[#F5F1EB]/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  )
}

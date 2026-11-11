import { useState, useEffect, useMemo } from 'react'
import {
  Download,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  History,
  X
} from 'lucide-react'
import { motion } from 'motion/react'
import { apiGet } from '../../utils/api'
import AuditExportSheet from './AuditExportSheet'
import AuditDetailModal from './AuditDetailModal'

function formatLogTime(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(d).replace(':', '.')
  } catch {
    return dateStr
  }
}

function getDateGroupLabel(dateStr) {
  if (!dateStr) return 'Lainnya'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Lainnya'
    const now = new Date()

    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((today - dDay) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hari Ini'
    if (diffDays === 1) return 'Kemarin'

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(d)
  } catch {
    return 'Lainnya'
  }
}

function getActionBadgeStyle(action, status) {
  if (status === 'DENIED' || action === 'ACCESS_DENIED') {
    return 'bg-[#FDF2F2] text-[#C0392B] border-[#F5C6CB]'
  }
  if (action === 'LOGIN') {
    return 'bg-[#EEF7F2] text-[#2F7D5B] border-[#BCE3CF]'
  }
  if (action === 'USER_CREATE' || action === 'ROLE_CREATE') {
    return 'bg-[#EEF5F9] text-[#3A6B80] border-[#6A9DB3]/40'
  }
  if (action === 'USER_UPDATE' || action === 'ROLE_UPDATE' || action === 'PASSWORD_CHANGE' || action === 'PASSWORD_RESET') {
    return 'bg-[#FFF6EE] text-[#B25E09] border-[#F3DFC9]'
  }
  if (action === 'ROLE_DELETE' || action === 'DEV_WIPE') {
    return 'bg-[#FDF2F2] text-[#C0392B] border-[#F5C6CB]'
  }
  if (action === 'EXPORT') {
    return 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
  }
  if (action === 'Ubah harga') {
    return 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
  }
  if (action === 'Ganti foto') {
    return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
  }
  if (action === 'Ubah produk') {
    return 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
  }
  return 'bg-[#F5F1EB] text-[#556575] border-[#EDE8DF]'
}

export default function AdminAuditLogsTab() {
  const [logs, setLogs] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [periodPreset, setPeriodPreset] = useState('TODAY') // Default "Hari Ini"
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [selectedLog, setSelectedLog] = useState(null)
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    let start = ''
    let end = ''
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (periodPreset === 'TODAY') {
      start = todayStr
      end = todayStr
    } else if (periodPreset === 'YESTERDAY') {
      const yest = new Date(now)
      yest.setDate(yest.getDate() - 1)
      start = yest.toISOString().slice(0, 10)
      end = start
    } else if (periodPreset === 'LAST_7_DAYS') {
      const past = new Date(now)
      past.setDate(past.getDate() - 6)
      start = past.toISOString().slice(0, 10)
      end = todayStr
    } else if (periodPreset === 'CUSTOM') {
      start = customStart
      end = customEnd
    }

    const params = new URLSearchParams()
    params.set('limit', '100')
    if (start) params.set('start_date', start)
    if (end) params.set('end_date', end)
    if (actionFilter !== 'ALL') params.set('action', actionFilter)

    apiGet(`/admin/audit-logs?${params.toString()}`)
      .then((res) => {
        if (isMounted) {
          setLogs(res.items || [])
          setTotalRecords(res.total_records || 0)
        }
      })
      .catch((err) => console.error('Failed to fetch audit logs:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [periodPreset, customStart, customEnd, actionFilter])

  // Filtered in memory for actor/summary query
  const displayedLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase().trim()
    return logs.filter((item) => {
      return (
        item.nama_user?.toLowerCase().includes(q) ||
        item.ringkasan?.toLowerCase().includes(q) ||
        item.aksi?.toLowerCase().includes(q)
      )
    })
  }, [logs, searchQuery])

  // Group logs by date headers
  const groupedLogs = useMemo(() => {
    const groups = []
    let currentGroup = null

    displayedLogs.forEach((log) => {
      const label = getDateGroupLabel(log.waktu)
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push(log)
    })

    return groups
  }, [displayedLogs])

  return (
    <div className="space-y-3">
      {/* Baris 1: Judul Ringkas "Log Aktivitas (N)" + Tombol "Ekspor" */}
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-sm font-bold font-heading text-[#2C3E50]">
          Log Aktivitas ({totalRecords})
        </h3>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExportSheetOpen(true)}
          className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-[#F5F1EB] text-[#3A6B80] border border-[#6A9DB3]/40 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
        >
          <Download className="w-4 h-4 stroke-[2.2]" />
          <span>Ekspor</span>
        </motion.button>
      </div>

      {/* Baris 2 Kontrol: Chips Periode yang Bisa Digeser + Gabungan Search & Filter Aksi */}
      <div className="space-y-2">
        {/* Preset Periode (Bisa digeser horizontal) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'LAST_7_DAYS', label: '7 Hari' },
            { id: 'ALL', label: 'Semua' },
            { id: 'CUSTOM', label: 'Pilih Tanggal' }
          ].map((item) => {
            const isSelected = periodPreset === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodPreset(item.id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                    : 'text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF]/40'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Custom date range jika "Pilih Tanggal" dipilih */}
        {periodPreset === 'CUSTOM' && (
          <div className="grid grid-cols-2 gap-2 bg-[#F5F1EB] p-2 rounded-xl border border-[#EDE8DF]">
            <div>
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Dari</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full text-xs p-1.5 bg-white border border-[#EDE8DF] rounded-lg focus:border-[#3A6B80] focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#6B7B8D] block mb-0.5">Sampai</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full text-xs p-1.5 bg-white border border-[#EDE8DF] rounded-lg focus:border-[#3A6B80] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Kolom Cari + Filter Aksi dalam 1 Baris */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B7B8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pelaku atau aktivitas..."
              className="w-full min-h-[38px] pl-8 pr-7 text-xs bg-white border border-[#EDE8DF] rounded-xl text-[#2C3E50] placeholder:text-[#94A3B8] focus:border-[#3A6B80] focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative shrink-0 flex items-center">
            <Filter className="w-3.5 h-3.5 text-[#6B7B8D] absolute left-2.5 pointer-events-none" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="min-h-[38px] pl-7 pr-6 text-xs bg-white border border-[#EDE8DF] rounded-xl text-[#2C3E50] focus:border-[#3A6B80] focus:outline-none transition-all cursor-pointer shadow-2xs font-medium"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="LOGIN">Login</option>
              <option value="USER_CREATE">Tambah Akun</option>
              <option value="USER_UPDATE">Ubah Akun</option>
              <option value="USER_STATUS_CHANGE">Status Akun</option>
              <option value="PASSWORD_RESET">Reset Password</option>
              <option value="ROLE_CREATE">Buat Role</option>
              <option value="ROLE_UPDATE">Ubah Role</option>
              <option value="ROLE_DELETE">Hapus Role</option>
              <option value="Ubah harga">Ubah Harga</option>
              <option value="Ganti foto">Ganti Foto</option>
              <option value="Ubah produk">Ubah Produk</option>
              <option value="ACCESS_DENIED">Akses Ditolak</option>
              <option value="EXPORT">Ekspor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Daftar Kartu Log Dikelompokkan per Tanggal */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs animate-pulse space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-[#EDE8DF] rounded w-24" />
                <div className="h-3 bg-[#EDE8DF] rounded w-12" />
              </div>
              <div className="h-3 bg-[#EDE8DF] rounded w-48" />
            </div>
          ))}
        </div>
      ) : groupedLogs.length === 0 ? (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center my-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center mx-auto text-[#6B7B8D] mb-3">
            <History className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-[#2C3E50]">Belum Ada Rekaman Log</h4>
          <p className="text-xs text-[#6B7B8D] max-w-xs mx-auto mt-1">
            Tidak ada aktivitas yang sesuai dengan filter atau kata kunci yang dipilih.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedLogs.map((group) => (
            <div key={group.label} className="space-y-2">
              {/* Header Tanggal */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="text-xs font-bold text-[#556575] tracking-tight uppercase">
                  {group.label}
                </span>
                <div className="h-px bg-[#EDE8DF] flex-1" />
              </div>

              {/* Kartu Log 2 Baris */}
              <div className="space-y-2">
                {group.items.map((log) => {
                  const isDenied = log.hasil === 'DENIED' || log.aksi === 'ACCESS_DENIED'
                  const badgeClass = getActionBadgeStyle(log.aksi, log.hasil)

                  // Format ringkasan: Untuk login cukup tampilkan pelaku, selain login tampilkan pelaku + ringkasan pendek
                  let summarySnippet = ''
                  if (log.aksi === 'LOGIN') {
                    summarySnippet = '' // Cukup nama pelaku
                  } else if (log.ringkasan) {
                    summarySnippet = log.ringkasan
                      .replace(/^Login berhasil untuk pengguna '.*?'\./, '')
                      .replace(/^Akun pengguna '.*?' telah /, '')
                      .trim()
                  }

                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => setSelectedLog(log)}
                      className={`bg-white border rounded-2xl p-3 shadow-2xs transition-all cursor-pointer hover:border-[#6A9DB3]/40 active:scale-[0.99] ${
                        isDenied ? 'border-[#F5C6CB] bg-[#FFFBFB]' : 'border-[#EDE8DF]'
                      }`}
                    >
                      {/* Baris 1: Badge Aksi + Ikon Status di kiri; Jam di kanan */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                          >
                            {log.aksi}
                          </span>

                          {isDenied ? (
                            <XCircle className="w-3.5 h-3.5 text-[#C0392B]" title="Ditolak (403)" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D5B]" title="Sukses" />
                          )}
                        </div>

                        <span className="text-xs text-[#6B7B8D] font-mono shrink-0">
                          {formatLogTime(log.waktu)}
                        </span>
                      </div>

                      {/* Baris 2: Pelaku + Ringkasan Singkat HANYA jika menambah info */}
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#2C3E50] truncate">
                        <span className="font-semibold text-[#2C3E50]">
                          @{log.nama_user || 'SYSTEM'}
                        </span>
                        {summarySnippet && (
                          <>
                            <span className="text-[#EDE8DF]">•</span>
                            <span className="text-[#556575] truncate font-normal">
                              {summarySnippet}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Log saat Kartu Diketuk */}
      <AuditDetailModal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />

      {/* Sheet Ekspor Laporan */}
      <AuditExportSheet
        isOpen={isExportSheetOpen}
        onClose={() => setIsExportSheetOpen(false)}
      />
    </div>
  )
}

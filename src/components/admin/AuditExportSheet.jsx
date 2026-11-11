import { useState, useId } from 'react'
import { Download, X, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'
import { apiGet } from '../../utils/api'
import { downloadExcelXml } from '../../utils/excelExport'

const PRESETS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: 'LAST_7_DAYS', label: '7 Hari Terakhir' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'CUSTOM', label: 'Rentang Tanggal' }
]

function getPresetDates(presetId) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (presetId === 'TODAY') {
    return { from: todayStr, to: todayStr }
  }
  if (presetId === 'YESTERDAY') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const yestStr = yest.toISOString().slice(0, 10)
    return { from: yestStr, to: yestStr }
  }
  if (presetId === 'LAST_7_DAYS') {
    const past = new Date(now)
    past.setDate(past.getDate() - 6)
    return { from: past.toISOString().slice(0, 10), to: todayStr }
  }
  if (presetId === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: start.toISOString().slice(0, 10), to: todayStr }
  }
  return { from: todayStr, to: todayStr }
}

export default function AuditExportSheet({ isOpen, onClose }) {
  useLockBodyScroll(isOpen)

  const [selectedPreset, setSelectedPreset] = useState('TODAY')
  const [dateFrom, setDateFrom] = useState(() => getPresetDates('TODAY').from)
  const [dateTo, setDateTo] = useState(() => getPresetDates('TODAY').to)
  const [actionCategory, setActionCategory] = useState('ALL') // 'ALL' | 'AUTH' | 'USER_ROLE' | 'SECURITY'
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const titleId = useId()

  if (!isOpen) return null

  const handleSelectPreset = (pId) => {
    setSelectedPreset(pId)
    setExportError('')
    if (pId !== 'CUSTOM') {
      const dates = getPresetDates(pId)
      setDateFrom(dates.from)
      setDateTo(dates.to)
    }
  }

  const handleExecuteExport = async () => {
    if (!dateFrom || !dateTo) {
      setExportError('Rentang tanggal wajib diisi.')
      return
    }

    if (dateFrom > dateTo) {
      setExportError('Tanggal akhir harus sama atau setelah tanggal awal.')
      return
    }

    try {
      setIsExporting(true)
      setExportError('')

      // Ambil data audit logs dari backend
      const res = await apiGet(`/admin/audit-logs?start_date=${dateFrom}&end_date=${dateTo}&limit=200`)
      const items = res.items || []

      if (items.length === 0) {
        setExportError('Tidak ada rekaman log audit pada periode yang dipilih.')
        return
      }

      // Filter aksi sesuai kategori jika dipilih
      const filtered = items.filter((item) => {
        if (actionCategory === 'ALL') return true
        if (actionCategory === 'AUTH') return item.aksi === 'LOGIN' || item.aksi === 'PASSWORD_CHANGE'
        if (actionCategory === 'USER_ROLE') {
          return item.aksi.startsWith('USER_') || item.aksi.startsWith('ROLE_')
        }
        if (actionCategory === 'PRODUCT') {
          return ['Ubah harga', 'Ganti foto', 'Ubah produk'].includes(item.aksi) || item.objek_tipe === 'PRODUCT'
        }
        if (actionCategory === 'SECURITY') {
          return item.aksi === 'ACCESS_DENIED' || item.hasil === 'DENIED'
        }
        return true
      })

      if (filtered.length === 0) {
        setExportError('Tidak ada rekaman log audit untuk kategori filter yang dipilih.')
        return
      }

      // Format data untuk ekspor Excel XML
      const excelColumns = [
        { header: 'No', key: 'no', width: 40, align: 'Center' },
        { header: 'Waktu (WIB)', key: 'waktu', width: 140, align: 'Center' },
        { header: 'Aktor / Pengguna', key: 'nama_user', width: 160 },
        { header: 'Aksi', key: 'aksi', width: 110, align: 'Center' },
        { header: 'Objek Tipe', key: 'objek_tipe', width: 90, align: 'Center' },
        { header: 'Objek ID', key: 'objek_id', width: 90 },
        { header: 'Ringkasan Aktivitas', key: 'ringkasan', width: 260 },
        { header: 'Status Hasil', key: 'hasil', width: 80, align: 'Center' },
        { header: 'IP Klien', key: 'ip', width: 110, align: 'Center' }
      ]

      const excelData = filtered.map((item, idx) => {
        let waktuWib = '-'
        try {
          const d = new Date(item.waktu)
          waktuWib = new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Jakarta'
          }).format(d) + ' WIB'
        } catch {
          waktuWib = item.waktu
        }

        return {
          no: idx + 1,
          waktu: waktuWib,
          nama_user: item.nama_user,
          aksi: item.aksi,
          objek_tipe: item.objek_tipe,
          objek_id: item.objek_id || '-',
          ringkasan: item.ringkasan,
          hasil: item.hasil,
          ip: item.ip || '-'
        }
      })

      const filename = `Audit_Log_${dateFrom}_sd_${dateTo}.xls`

      downloadExcelXml({
        fileName: filename,
        sheetName: 'Audit Activity',
        title: 'PT MAKAN DIMSUM INDONESIA - LOG AUDIT AKTIVITAS SISTEM',
        subtitles: [
          `Periode Laporan: ${dateFrom} s/d ${dateTo}`,
          `Kategori: ${actionCategory}`,
          `Total Catatan: ${filtered.length} Aktivitas`,
          `Dicetak Pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
        ],
        columns: excelColumns,
        data: excelData
      })

      onClose()
    } catch (err) {
      setExportError(err.message || 'Gagal mengekspor log audit.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-none transition-opacity overscroll-contain select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md md:max-w-xl mx-auto bg-white rounded-t-[24px] border-t border-[#EDE8DF] shadow-2xl p-4 sm:p-5 pb-8 safe-bottom-padding select-text max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Bar */}
        <div className="w-10 h-1 bg-[#EDE8DF] rounded-full mx-auto mb-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE8DF] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EEF5F9] border border-[#6A9DB3]/30 flex items-center justify-center text-[#3A6B80]">
              <FileSpreadsheet className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 id={titleId} className="text-sm font-bold font-heading text-[#2C3E50]">
                Ekspor Log Audit Aktivitas
              </h3>
              <p className="text-[11px] text-[#6B7B8D] mt-0.5">
                Unduh rekam jejak aktivitas sistem ke format Excel (.xls)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 my-4 overflow-y-auto flex-1 pr-1">
          {/* Preset Periode */}
          <div>
            <label className="text-xs font-semibold text-[#2C3E50] block mb-1.5">
              Pilih Periode Waktu
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const isSelected = selectedPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#3A6B80] text-white border-[#3A6B80] shadow-2xs'
                        : 'bg-[#F5F1EB] text-[#556575] border-[#EDE8DF] hover:bg-white'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Rentang Tanggal */}
          <div className="grid grid-cols-2 gap-2.5 bg-[#F5F1EB] border border-[#EDE8DF] p-3 rounded-xl">
            <div>
              <label className="text-[11px] font-semibold text-[#6B7B8D] block mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setSelectedPreset('CUSTOM')
                  setExportError('')
                }}
                className="w-full min-h-[40px] px-2.5 text-xs bg-white border border-[#EDE8DF] rounded-lg text-[#2C3E50] focus:border-[#3A6B80] focus:outline-none transition-all cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#6B7B8D] block mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setSelectedPreset('CUSTOM')
                  setExportError('')
                }}
                className="w-full min-h-[40px] px-2.5 text-xs bg-white border border-[#EDE8DF] rounded-lg text-[#2C3E50] focus:border-[#3A6B80] focus:outline-none transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Kategori Aksi */}
          <div>
            <label className="text-xs font-semibold text-[#2C3E50] block mb-1.5">
              Kategori Aktivitas
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'ALL', label: 'Semua Aktivitas' },
                { id: 'PRODUCT', label: 'Produk & Harga' },
                { id: 'AUTH', label: 'Login & Password' },
                { id: 'USER_ROLE', label: 'Mutasi User & Role' },
                { id: 'SECURITY', label: 'Akses Ditolak (403)' }
              ].map((cat) => {
                const isSelected = actionCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActionCategory(cat.id)}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#EEF5F9] text-[#3A6B80] font-bold border-[#6A9DB3]/40 shadow-2xs'
                        : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {exportError && (
            <div className="bg-[#FDF2F2] border border-[#F5C6CB] rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#C0392B] shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-[#C0392B] leading-relaxed">
                {exportError}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EDE8DF] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#6B7B8D] hover:bg-[#F5F1EB] rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="min-h-[44px] px-5 py-2 bg-[#2F7D5B] hover:bg-[#256349] text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Mengekspor...' : 'Unduh File Excel'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

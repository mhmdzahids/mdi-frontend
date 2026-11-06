import { useState, useEffect, useCallback, useMemo } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { exportPpicRecapExcel } from '../utils/excelExport'
import { SquarePen, Lock } from 'lucide-react'

const DIVISION_CONFIG = [
  { id: 'DAGING', name: 'Daging (Giling & Mix)', defaultUnit: 'KG' },
  { id: 'BUMBU', name: 'Bumbu Sparta', defaultUnit: 'PORSI' },
  { id: 'KULIT', name: 'Kulit Dimsum', defaultUnit: 'BAL' },
  { id: 'SAOS', name: 'Saos Dimsum', defaultUnit: 'BAL' },
  { id: 'CETAK', name: 'Meja Cetak', defaultUnit: 'PCS' },
  { id: 'PACKING', name: 'Meja Packing', defaultUnit: 'PACK' }
]

const getTodayStr = () => new Date().toISOString().slice(0, 10)
const getYesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function formatIndoDate(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return dStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const day = parseInt(parts[2], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${months[monthIdx] || parts[1]} ${year}`
}

function formatIndoDateFull(dStr) {
  if (!dStr) return ''
  const parts = dStr.split('-')
  if (parts.length !== 3) return dStr
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const day = parseInt(parts[2], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const year = parts[0]
  return `${day} ${months[monthIdx] || parts[1]} ${year}`
}

export default function PpicDailySummaryView() {
  const [filterPreset, setFilterPreset] = useState('today') // 'today' | 'yesterday' | 'single' | 'range'
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [rangeStartDate, setRangeStartDate] = useState(getTodayStr())
  const [rangeEndDate, setRangeEndDate] = useState(getTodayStr())

  const [selectedDivForEdit, setSelectedDivForEdit] = useState(null)
  const [rejectCountInput, setRejectCountInput] = useState('')
  const [rejectNotesInput, setRejectNotesInput] = useState('')
  const [opNotesInput, setOpNotesInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const dailyRecapData = useProduction1Store((s) => s.dailyRecapData)
  const fetchDailyRecap = useProduction1Store((s) => s.fetchDailyRecap)
  const saveDailyNote = useProduction1Store((s) => s.saveDailyNote)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)

  const todayStr = getTodayStr()
  const isRange = filterPreset === 'range'
  const isHistorical = filterPreset === 'range' || filterPreset === 'yesterday' || (filterPreset === 'single' && selectedDate !== todayStr)

  const activePeriodLabel = isRange
    ? `${formatIndoDate(rangeStartDate)} – ${formatIndoDate(rangeEndDate)}`
    : formatIndoDateFull(selectedDate)

  const activeExportDateStr = isRange
    ? `${rangeStartDate} s/d ${rangeEndDate}`
    : selectedDate

  const loadRecap = useCallback(() => {
    if (filterPreset === 'range') {
      fetchDailyRecap(rangeStartDate, rangeEndDate)
    } else {
      fetchDailyRecap(selectedDate)
    }
  }, [fetchDailyRecap, filterPreset, rangeStartDate, rangeEndDate, selectedDate])

  useEffect(() => {
    fetchDailyRecap(todayStr)
  }, [fetchDailyRecap, todayStr])

  const applyPreset = (preset) => {
    setFilterPreset(preset)
    if (preset === 'today') {
      const t = getTodayStr()
      setSelectedDate(t)
      fetchDailyRecap(t)
    } else if (preset === 'yesterday') {
      const y = getYesterdayStr()
      setSelectedDate(y)
      fetchDailyRecap(y)
    } else if (preset === 'single') {
      fetchDailyRecap(selectedDate)
    } else if (preset === 'range') {
      fetchDailyRecap(rangeStartDate, rangeEndDate)
    }
  }

  const openEditModal = (divConfig) => {
    if (isHistorical) return
    const currentRecap = dailyRecapData?.divisions?.[divConfig.id] || {}
    setSelectedDivForEdit(divConfig)
    setRejectCountInput(currentRecap.reject_count !== undefined ? String(currentRecap.reject_count) : '0')
    setRejectNotesInput(currentRecap.reject_notes || '')
    setOpNotesInput(currentRecap.operational_notes || '')
    setFeedback(null)
  }

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (!selectedDivForEdit || isHistorical) return

    setSavingNote(true)
    setFeedback(null)
    try {
      await saveDailyNote({
        division: selectedDivForEdit.id,
        reject_count: parseInt(rejectCountInput, 10) || 0,
        reject_notes: rejectNotesInput.trim() || null,
        operational_notes: opNotesInput.trim() || null,
        created_by: operatorName || operatorId || 'PPIC-AYU'
      })
      setFeedback({ type: 'success', message: `Catatan divisi ${selectedDivForEdit.name} berhasil disimpan.` })
      setSelectedDivForEdit(null)
      loadRecap()
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Gagal menyimpan catatan.' })
    } finally {
      setSavingNote(false)
    }
  }

  const handleExportExcel = () => {
    exportPpicRecapExcel({
      dateStr: activeExportDateStr,
      recapData: dailyRecapData,
      operatorName: operatorName || 'Ayu (PPIC)'
    })
  }

  const divisions = dailyRecapData?.divisions || {}
  const primaryOfficer = useMemo(() => {
    const officers = DIVISION_CONFIG.map((d) => divisions[d.id]?.updated_by).filter(Boolean)
    if (officers.length === 0) return operatorName || operatorId || 'PPIC-AYU'
    const counts = {}
    officers.forEach((o) => {
      counts[o] = (counts[o] || 0) + 1
    })
    let top = officers[0]
    let max = 0
    for (const [name, count] of Object.entries(counts)) {
      if (count > max) {
        max = count
        top = name
      }
    }
    return top || operatorName || operatorId || 'PPIC-AYU'
  }, [divisions, operatorName, operatorId])
  const totalReject = Object.values(divisions).reduce(
    (acc, div) => acc + (typeof div.reject_count === 'number' ? div.reject_count : 0),
    0
  )
  const totalLots = Object.values(divisions).reduce(
    (acc, div) => acc + (typeof div.total_lots === 'number' ? div.total_lots : 0),
    0
  )

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 font-sans pb-28">
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between ${feedback.type === 'success'
            ? 'bg-[#EBF7EE] text-[#1E7E34] border border-[#C3E6CB]'
            : 'bg-[#FDF0ED] text-[#D32F2F] border border-[#F5C6CB]'
            }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-3 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar Filter Tanggal & Periode */}
      <div className="bg-white border border-[#EDE8DF] rounded-3xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-stretch gap-1.5 p-1 bg-[#F5F1EB] rounded-2xl w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'today'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => applyPreset('yesterday')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'yesterday'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Kemarin
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'single'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Pilih Tanggal
          </button>
          <button
            type="button"
            onClick={() => applyPreset('range')}
            className={`flex-1 sm:flex-none min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center leading-tight ${filterPreset === 'range'
              ? 'bg-white text-[#2C3E50] shadow-xs'
              : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
          >
            Rentang Tanggal
          </button>
        </div>

        {/* Input Tanggal Tunggal */}
        {filterPreset === 'single' && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
            <span className="text-xs font-bold text-[#6B7B8D]">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value
                setSelectedDate(val)
                if (val) fetchDailyRecap(val)
              }}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
          </div>
        )}

        {/* Input Rentang Tanggal */}
        {filterPreset === 'range' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EDE8DF]">
            <span className="text-xs font-bold text-[#6B7B8D]">Dari:</span>
            <input
              type="date"
              value={rangeStartDate}
              onChange={(e) => setRangeStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
            <span className="text-xs font-bold text-[#6B7B8D]">Sampai:</span>
            <input
              type="date"
              value={rangeEndDate}
              onChange={(e) => setRangeEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#EDE8DF] text-xs font-semibold text-[#2C3E50] bg-white focus:outline-none focus:ring-2 focus:ring-[#3A6B80]"
            />
            <button
              type="button"
              onClick={() => {
                if (rangeStartDate && rangeEndDate) {
                  fetchDailyRecap(rangeStartDate, rangeEndDate)
                }
              }}
              className="px-3.5 py-1.5 bg-[#3A6B80] hover:bg-[#2C3E50] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* Ringkasan Ringkas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
          <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
            Target Gilingan
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#2C3E50] mt-1">
            {dailyRecapData?.target_gilingan || 0}
          </div>
          <div className="text-[11px] text-[#6B7B8D] mt-0.5">Target shift</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
          <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
            Barcode Terbit
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#4685ac] mt-1">
            {totalLots}
          </div>
          <div className="text-[11px] text-[#6B7B8D] mt-0.5">Total lot terbit</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
          <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
            Total Reject
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#D32F2F] mt-1">
            {totalReject}
          </div>
          <div className="text-[11px] text-[#6B7B8D] mt-0.5">Semua stasiun</div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs">
          <div className="text-[11px] font-bold text-[#6B7B8D] uppercase tracking-wider">
            Barang Masuk
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#3A6B80] mt-1">
            {dailyRecapData?.supplier_inbound?.length || 0}
          </div>
          <div className="text-[11px] text-[#6B7B8D] mt-0.5">Inbound supplier</div>
        </div>
      </div>

      {/* Tombol Unduh Excel */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleExportExcel}
          className="min-h-[44px] px-4 py-2 bg-white hover:bg-[#F5F1EB] active:bg-[#EDE8DF] border border-[#3A6B80] text-[#3A6B80] text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3A6B80] shadow-2xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Unduh Excel</span>
        </button>
      </div>

      {/* Daftar Kartu Rekap Per Divisi */}
      <div className="space-y-4">
        {DIVISION_CONFIG.map((divConfig) => {
          const divData = divisions[divConfig.id] || {}
          const isProd2 = divConfig.id === 'CETAK' || divConfig.id === 'PACKING'

          const hasDiffOfficer = Boolean(divData.updated_by && divData.updated_by !== primaryOfficer)

          return (
            <div
              key={divConfig.id}
              className="border border-bg-cream-dark shadow-2xs rounded-2xl bg-white overflow-hidden"
            >
              {/* Header Card Satu Baris */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-bg-cream-dark">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h2 className="text-sm font-bold text-text-primary tracking-tight">
                    {divConfig.name}
                  </h2>
                  {hasDiffOfficer && (
                    <span className="text-[11px] font-medium text-text-secondary bg-bg-cream px-2 py-0.5 rounded-md border border-bg-cream-dark">
                      Petugas: {divData.updated_by}
                    </span>
                  )}
                  {divData.reject_count > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-red/10 text-brand-red border border-brand-red/20">
                      {divData.reject_count} Reject
                    </span>
                  )}
                </div>

                {isHistorical ? (
                  <div
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary/60"
                    title="Arsip Riwayat"
                    aria-label="Arsip Riwayat"
                  >
                    <Lock className="w-5 h-5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openEditModal(divConfig)}
                    aria-label="Catat Reject & Kendala"
                    title="Catat Reject & Kendala"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-brand-blue hover:text-brand-blue-dark hover:bg-bg-cream active:scale-95 transition-all cursor-pointer"
                  >
                    <SquarePen className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Metrik Satu Baris */}
              {isProd2 ? (
                <div className="grid grid-cols-2 gap-3 px-4 py-3">
                  <div>
                    <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                      Status
                    </div>
                    <div className="text-lg font-semibold text-text-primary mt-0.5">
                      Aktif
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                      Total Kuantitas
                    </div>
                    <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                      {divData.total_quantity || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.defaultUnit}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 px-4 py-3">
                  <div>
                    <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                      Lot Barcode
                    </div>
                    <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                      {divData.total_lots || 0} <span className="text-xs font-normal text-text-secondary">lot</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                      Total Kuantitas
                    </div>
                    <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                      {divData.total_quantity || 0} <span className="text-xs font-normal text-text-secondary">{divConfig.defaultUnit}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-text-secondary leading-tight truncate">
                      Terkirim / Siap
                    </div>
                    <div className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
                      {divData.completed_count || 0}
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan Reject & Operasional (Hanya jika ada isinya) */}
              {(divData.reject_notes || divData.operational_notes) && (
                <div className="px-4 pb-3 pt-2.5 border-t border-bg-cream-dark space-y-1 text-xs">
                  {divData.reject_notes && (
                    <div className="leading-relaxed">
                      <span className="font-semibold text-text-primary">Alasan Reject: </span>
                      <span className="text-text-secondary">{divData.reject_notes}</span>
                    </div>
                  )}
                  {divData.operational_notes && (
                    <div className="leading-relaxed">
                      <span className="font-semibold text-text-primary">Catatan Operasional: </span>
                      <span className="text-text-secondary">{divData.operational_notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Edit Catatan & Reject */}
      {selectedDivForEdit && !isHistorical && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-[#EDE8DF] overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#F5F1EB] border-b border-[#EDE8DF] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#2C3E50]">
                  Catatan & Reject: {selectedDivForEdit.name}
                </h3>
                <p className="text-xs text-[#6B7B8D] mt-0.5">
                  Pencatatan reject dan kendala operasional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDivForEdit(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#EDE8DF] text-[#6B7B8D] hover:text-[#2C3E50] flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Jumlah Reject
                </label>
                <Input
                  type="number"
                  min="0"
                  value={rejectCountInput}
                  onChange={(e) => setRejectCountInput(e.target.value)}
                  placeholder="0"
                  required
                  disabled={savingNote}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Alasan Reject
                </label>
                <textarea
                  value={rejectNotesInput}
                  onChange={(e) => setRejectNotesInput(e.target.value)}
                  placeholder="Contoh: Daging berlemak keras dipisahkan, kulit kering tepi, sobek saat cetak..."
                  rows={2}
                  disabled={savingNote}
                  className="w-full p-3 rounded-2xl border border-[#EDE8DF] text-xs sm:text-sm text-[#2C3E50] placeholder:text-[#6B7B8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3E50] mb-1.5 uppercase tracking-wide">
                  Catatan Kendala Operasional
                </label>
                <textarea
                  value={opNotesInput}
                  onChange={(e) => setOpNotesInput(e.target.value)}
                  placeholder="Contoh: Selesai shift tepat waktu, mesin giling sempat mati listrik 10 menit..."
                  rows={3}
                  disabled={savingNote}
                  className="w-full p-3 rounded-2xl border border-[#EDE8DF] text-xs sm:text-sm text-[#2C3E50] placeholder:text-[#6B7B8D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDivForEdit(null)}
                  disabled={savingNote}
                  className="flex-1 min-h-[44px]"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingNote}
                  disabled={savingNote}
                  className="flex-1 min-h-[44px] bg-[#4685ac] hover:bg-[#3A6B80]"
                >
                  Simpan Catatan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

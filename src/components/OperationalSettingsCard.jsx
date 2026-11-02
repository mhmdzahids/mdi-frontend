import { useState, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import ScanModeSettingsCard from './ScanModeSettingsCard'
import { RefreshIcon, CheckIcon } from './Icons'
import { Trash2 } from 'lucide-react'
import { Modal } from './ui/Modal'

export default function OperationalSettingsCard() {
  const employeeDateScope = useProduction1Store((s) => s.employeeDateScope)
  const setEmployeeDateScope = useProduction1Store((s) => s.setEmployeeDateScope)
  const ppicExternalWrapperMode = useProduction1Store((s) => s.ppicExternalWrapperMode)
  const setPpicExternalWrapperMode = useProduction1Store((s) => s.setPpicExternalWrapperMode)
  const planDetailMode = useProduction1Store((s) => s.planDetailMode) || 'GENERAL'
  const setPlanDetailMode = useProduction1Store((s) => s.setPlanDetailMode)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isPpicUser = useProduction1Store((s) => s.isPpicUser)
  const wipeDatabase = useProduction1Store((s) => s.wipeDatabase)

  const [scope, setScope] = useState(employeeDateScope || 'TODAY')
  const [detailMode, setDetailMode] = useState(planDetailMode || 'GENERAL')
  const [wrapperMode, setWrapperMode] = useState(ppicExternalWrapperMode || 'DIRECT')
  const [saveNotification, setSaveNotification] = useState('')
  const [isSavedRecently, setIsSavedRecently] = useState(false)

  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false)
  const [isWiping, setIsWiping] = useState(false)
  const [wipeFeedback, setWipeFeedback] = useState('')

  useEffect(() => {
    if (employeeDateScope) setScope(employeeDateScope)
  }, [employeeDateScope])

  useEffect(() => {
    if (planDetailMode) setDetailMode(planDetailMode)
  }, [planDetailMode])

  useEffect(() => {
    if (ppicExternalWrapperMode) setWrapperMode(ppicExternalWrapperMode)
  }, [ppicExternalWrapperMode])

  const isPPIC = isPpicUser ? isPpicUser() : Boolean(
    currentUser && (
      currentUser.username === 'supervisor' ||
      (currentUser.division && currentUser.division.toLowerCase().includes('ppic')) ||
      (currentUser.operator_id && currentUser.operator_id.toUpperCase().includes('YOSI')) ||
      (currentUser.division && currentUser.division.toLowerCase().includes('supervisor'))
    )
  )

  const handleSaveSettings = () => {
    setEmployeeDateScope(scope)
    setPlanDetailMode(detailMode)
    if (isPPIC) {
      setPpicExternalWrapperMode(wrapperMode)
    }

    const modeLabel = detailMode === 'DETAILED' ? 'Spesifik' : 'Ringkas'
    setSaveNotification(`Pengaturan berhasil disimpan (Format: ${modeLabel})`)
    setIsSavedRecently(true)

    setTimeout(() => {
      setIsSavedRecently(false)
    }, 2500)

    setTimeout(() => {
      setSaveNotification('')
    }, 4000)
  }

  const handleConfirmWipe = async () => {
    setIsWiping(true)
    try {
      await wipeDatabase()
      setIsWipeModalOpen(false)
      setWipeFeedback('Semua data uji coba berhasil dibersihkan.')
      setTimeout(() => setWipeFeedback(''), 4000)
    } catch (err) {
      setWipeFeedback(err?.message || 'Gagal reset database.')
    } finally {
      setIsWiping(false)
    }
  }

  return (
    <div className="space-y-3.5">
      {/* 1. Tampilkan Data Riwayat */}
      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 space-y-2.5 shadow-2xs">
        <div>
          <span className="text-xs font-bold text-[#1E293B] block">
            Jangkauan Riwayat Data
          </span>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            Pilih rentang data yang muncul di riwayat dan stasiun kerja
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'TWO_DAYS', label: '2 Hari Lalu' },
            { id: 'ALL', label: 'Semua' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setScope(item.id)
                setSaveNotification('')
              }}
              className={`min-h-[44px] py-2 px-1 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                scope === item.id
                  ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                  : 'bg-white text-[#1E293B] border-[#EDE8DF] hover:bg-[#F5F1EB]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Format Input Kulit & Saos (Ringkas vs Spesifik) */}
      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 space-y-2.5 shadow-2xs">
        <div>
          <span className="text-xs font-bold text-[#1E293B] block">
            Format Input Kulit & Saos
          </span>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            Pilih formulir rencana bahan ditampilkan umum atau spesifik per produk
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setDetailMode('GENERAL')
              setSaveNotification('')
            }}
            className={`min-h-[44px] py-2 px-3 rounded-xl font-bold text-center border transition-all cursor-pointer ${
              detailMode === 'GENERAL'
                ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                : 'bg-white text-[#1E293B] border-[#EDE8DF] hover:bg-[#F5F1EB]'
            }`}
          >
            Ringkas (Umum)
          </button>
          <button
            type="button"
            onClick={() => {
              setDetailMode('DETAILED')
              setSaveNotification('')
            }}
            className={`min-h-[44px] py-2 px-3 rounded-xl font-bold text-center border transition-all cursor-pointer ${
              detailMode === 'DETAILED'
                ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                : 'bg-white text-[#1E293B] border-[#EDE8DF] hover:bg-[#F5F1EB]'
            }`}
          >
            Spesifik (Mika & Vakum)
          </button>
        </div>
      </div>

      {/* 3. Alur Cetak Kulit PPIC (Khusus PPIC / Supervisor) */}
      {isPPIC && (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 space-y-2.5 shadow-2xs">
          <div>
            <span className="text-xs font-bold text-[#1E293B] block">
              Alur Cetak Kulit di Halaman Rencana
            </span>
            <span className="text-[11px] text-[#64748B] block mt-0.5">
              Tentukan aksi tombol kulit di form rencana harian
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setWrapperMode('DIRECT')
                setSaveNotification('')
              }}
              className={`min-h-[44px] py-2 px-3 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                wrapperMode === 'DIRECT'
                  ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                  : 'bg-white text-[#1E293B] border-[#EDE8DF] hover:bg-[#F5F1EB]'
              }`}
            >
              Langsung di Rencana
            </button>
            <button
              type="button"
              onClick={() => {
                setWrapperMode('REDIRECT')
                setSaveNotification('')
              }}
              className={`min-h-[44px] py-2 px-3 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                wrapperMode === 'REDIRECT'
                  ? 'bg-[#1E293B] text-white border-[#1E293B] shadow-2xs'
                  : 'bg-white text-[#1E293B] border-[#EDE8DF] hover:bg-[#F5F1EB]'
              }`}
            >
              Buka Tab Kulit
            </button>
          </div>
        </div>
      )}

      {/* Aksi Simpan Pengaturan & Notifikasi */}
      <div className="space-y-2 pt-0.5">
        {saveNotification && (
          <div
            role="status"
            className="flex items-center gap-2 p-3 bg-[#EAF5EE] border border-[#CBEAD6] rounded-xl text-[#2F7D5B] text-xs font-semibold animate-in fade-in"
          >
            <CheckIcon className="w-4 h-4 text-[#2F7D5B] shrink-0" />
            <span>{saveNotification}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveSettings}
          className={`w-full min-h-[46px] py-2.5 px-4 rounded-xl font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99] ${
            isSavedRecently
              ? 'bg-[#2F7D5B] hover:bg-[#286A4E]'
              : 'bg-[#4685ac] hover:bg-[#3A6B80]'
          }`}
        >
          <CheckIcon className="w-4 h-4" />
          <span>{isSavedRecently ? 'Pengaturan Tersimpan' : 'Simpan Pengaturan'}</span>
        </button>
      </div>

      {/* 4. Mode Scan Stasiun (1x vs 2x) */}
      <ScanModeSettingsCard />

      {/* 5. Reset Data Operasional (Hanya tampil untuk PPIC/Supervisor) */}

      {isPPIC && (
        <div className="bg-white border border-[#FADBD8] rounded-2xl p-4 space-y-3 shadow-2xs">
          <div>
            <span className="text-xs font-bold text-[#9F2F2D] block">
              Reset Data Operasional
            </span>
            <span className="text-[11px] text-[#64748B] block mt-0.5">
              Bersihkan seluruh data lot, log perpindahan, dan riwayat scan uji coba
            </span>
          </div>

          {wipeFeedback && (
            <div className="p-2.5 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] text-xs text-[#1E293B]">
              {wipeFeedback}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsWipeModalOpen(true)}
            className="w-full min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-[#E8352D] hover:bg-[#C92A24] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua Data Uji Coba</span>
          </button>
        </div>
      )}

      {/* Modal Konfirmasi Wipe Database Sederhana */}
      <Modal
        isOpen={isWipeModalOpen}
        onClose={() => !isWiping && setIsWipeModalOpen(false)}
        title="Hapus Semua Data?"
        size="sm"
      >
        <div className="space-y-3 text-xs">
          <p className="text-[#64748B] leading-relaxed">
            Semua data lot, riwayat scan, dan perpindahan barang akan dihapus bersih. Rencana harian akan direset ke awal. Tindakan ini tidak bisa dibatalkan.
          </p>

          <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
            <button
              type="button"
              disabled={isWiping}
              onClick={() => setIsWipeModalOpen(false)}
              className="flex-1 min-h-[44px] py-2 px-3 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-[#1E293B] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isWiping}
              onClick={handleConfirmWipe}
              className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-[#E8352D] hover:bg-[#C92A24] text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
            >
              {isWiping ? (
                <>
                  <RefreshIcon className="w-4 h-4 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Ya, Hapus Data</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}


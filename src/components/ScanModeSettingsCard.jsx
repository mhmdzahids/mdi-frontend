import { useState, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { SegmentedControl } from './ui/SegmentedControl'
import { Badge } from './ui/Badge'
import { CheckIcon, AlertIcon } from './Icons'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

const STATION_LIST = [
  { id: 'MEAT_STATION', label: 'Daging / Giling' },
  { id: 'SEASONING_STATION', label: 'Bumbu Racik' },
  { id: 'WRAPPER_STATION', label: 'Kulit Dimsum' },
  { id: 'SAUCE_STATION', label: 'Saos Dimsum' },
  { id: 'ASSEMBLY_STATION', label: 'Meja Cetak' },
  { id: 'FINISHING_STATION', label: 'Meja Packing' }
]

const GLOBAL_OPTIONS = [
  { value: '1X', label: 'Mode 1x' },
  { value: '2X', label: 'Mode 2x' }
]

const STATION_MODE_OPTIONS = [
  { value: 'INHERIT', label: 'Ikut default' },
  { value: '1X', label: '1x' },
  { value: '2X', label: '2x' }
]

export default function ScanModeSettingsCard() {
  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)
  const isScanModeLoading = useProduction1Store((s) => s.isScanModeLoading)
  const fetchScanModeSettings = useProduction1Store((s) => s.fetchScanModeSettings)
  const updateScanModeSettings = useProduction1Store((s) => s.updateScanModeSettings)
  const userRole = useProduction1Store((s) => s.userRole)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const scanCooldownSeconds = useProduction1Store((s) => s.scanCooldownSeconds)
  const setScanCooldownSeconds = useProduction1Store((s) => s.setScanCooldownSeconds)

  const isPIC =
    userRole === 'STAKEHOLDER' ||
    userRole === 'SUPERVISOR' ||
    userRole === 'ADMIN' ||
    (operatorId || '').toUpperCase().includes('PIC') ||
    (operatorId || '').toUpperCase().includes('SPV')

  // Local user overrides (null indicates taking value directly from server settings)
  const [overrideGlobal, setOverrideGlobal] = useState(null)
  const [overrideStations, setOverrideStations] = useState({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  useLockBodyScroll(showConfirmModal)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    fetchScanModeSettings()
  }, [fetchScanModeSettings])

  const effectiveGlobal = overrideGlobal ?? (scanModeSettings?.global_mode || '1X')
  const effectiveStations = {
    ...(scanModeSettings?.station_modes || {}),
    ...overrideStations
  }

  const hasChanges =
    (overrideGlobal !== null && overrideGlobal !== (scanModeSettings?.global_mode || '1X')) ||
    Object.keys(overrideStations).some(
      (k) => overrideStations[k] !== (scanModeSettings?.station_modes?.[k] || 'INHERIT')
    )

  const handleStationModeChange = (stationId, val) => {
    setOverrideStations((prev) => ({
      ...prev,
      [stationId]: val
    }))
  }

  const handleConfirmSave = async () => {
    const payload = {
      global_mode: effectiveGlobal,
      station_modes: effectiveStations
    }
    const res = await updateScanModeSettings(payload)
    if (res?.success) {
      setOverrideGlobal(null)
      setOverrideStations({})
      setShowConfirmModal(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const affectedCount = scanModeSettings?.affected_printed_lots_count || 0

  return (
    <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 space-y-4 shadow-2xs">
      {/* Header Kartu */}
      <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3">
        <div>
          <span className="text-xs font-bold text-[#2C3E50] block">
            Mode Scan Operasional (1x / 2x)
          </span>
          <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
            Berlaku langsung di semua stasiun kerja tanpa restart server
          </span>
        </div>
        <Badge variant={scanModeSettings?.global_mode === '2X' ? 'info' : 'neutral'} size="sm">
          Aktif: Mode {scanModeSettings?.global_mode || '1X'}
        </Badge>
      </div>

      {/* Kontrol Pilihan Mode Global */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#2C3E50]">
            Default Global
          </span>
          <span className="text-[11px] text-[#6B7B8D]">
            Semua stasiun mewarisi mode ini kecuali di-override
          </span>
        </div>

        <SegmentedControl
          options={GLOBAL_OPTIONS}
          value={effectiveGlobal}
          onChange={(val) => isPIC && setOverrideGlobal(val)}
        />

        {/* 1 Kalimat Penjelasan Per Mode Tanpa Pengulangan */}
        <div className="p-2.5 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] text-xs text-[#2C3E50]">
          {effectiveGlobal === '1X' ? (
            <span>Scan langsung mengeluarkan barang ke stasiun tujuan.</span>
          ) : (
            <span>Scan pertama konfirmasi stok fisik stasiun, scan kedua mengeluarkan barang.</span>
          )}
        </div>
      </div>

      {/* Override Mode Per Stasiun */}
      <div className="space-y-2.5 pt-1 border-t border-[#EDE8DF]">
        <span className="text-xs font-bold text-[#2C3E50] block">
          Pengaturan Khusus Per Stasiun
        </span>

        <div className="space-y-2">
          {STATION_LIST.map((st) => {
            const currentVal = effectiveStations[st.id] || 'INHERIT'
            const effectiveMode = currentVal === 'INHERIT' ? effectiveGlobal : currentVal

            return (
              <div
                key={st.id}
                className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-xs font-semibold text-[#2C3E50]">{st.label}</span>
                  <Badge variant={effectiveMode === '2X' ? 'info' : 'neutral'} size="sm">
                    {effectiveMode}
                  </Badge>
                </div>

                <div className="w-full sm:w-auto">
                  <SegmentedControl
                    options={STATION_MODE_OPTIONS}
                    value={currentVal}
                    onChange={(val) => isPIC && handleStationModeChange(st.id, val)}
                    size="sm"
                    fullWidth={false}
                    className="sm:min-w-[280px]"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Interval Jeda Scan Kamera (Cooldown) */}
      <div className="space-y-2.5 pt-1 border-t border-[#EDE8DF]">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#2C3E50]">
            Interval Jeda Scan Kamera (Cooldown)
          </span>
          <span className="text-[11px] text-[#6B7B8D]">
            Mencegah kamera scan berulang kali saat masih mengarah ke 1 QR yang sama.
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 5].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setScanCooldownSeconds(sec)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                scanCooldownSeconds === sec
                  ? 'bg-[#2C3E50] text-white border-[#2C3E50] shadow-xs'
                  : 'bg-white text-[#6B7B8D] border-[#EDE8DF] hover:bg-[#F5F1EB]'
              }`}
            >
              {sec} Detik
            </button>
          ))}
        </div>
      </div>

      {/* Tombol Simpan & Status Hak Akses */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-[#EDE8DF]">
        <div>
          {!isPIC ? (
            <span className="text-[11px] text-[#A8862E] font-medium flex items-center gap-1.5">
              <AlertIcon className="w-4 h-4" />
              Mode hanya dapat diubah oleh PIC atau Supervisor.
            </span>
          ) : saveSuccess ? (
            <span className="text-[11px] text-[#2F7D5B] font-bold flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4" />
              Pengaturan mode scan berhasil disimpan!
            </span>
          ) : hasChanges ? (
            <span className="text-[11px] text-[#4685ac] font-medium">
              Ada perubahan pengaturan yang belum disimpan.
            </span>
          ) : (
            <span className="text-[11px] text-[#6B7B8D]">
              Pengaturan tersimpan & sinkron dengan server.
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!isPIC || !hasChanges || isScanModeLoading}
          onClick={() => setShowConfirmModal(true)}
          className="h-11 px-5 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 shadow-xs flex items-center justify-center gap-2"
        >
          {isScanModeLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      {/* Modal Konfirmasi Sebelum Menyimpan */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 overscroll-contain select-none"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault()
          }}
        >
          <div className="bg-white border border-[#EDE8DF] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="space-y-1">
              <span className="text-sm font-bold text-[#2C3E50] block">
                Konfirmasi Perubahan Mode Scan
              </span>
              <p className="text-xs text-[#6B7B8D]">
                Anda akan mengubah konfigurasi mode scan operasional.
              </p>
            </div>

            {/* Preview Dampak Lot */}
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-1.5 text-xs text-[#2C3E50]">
              <span className="font-bold text-[#A8862E] block">
                Ringkasan Dampak:
              </span>
              <p className="text-[11px] text-[#2C3E50] leading-relaxed">
                Mode Global akan menjadi <strong className="font-bold">{effectiveGlobal}</strong>.
              </p>
              {affectedCount > 0 && effectiveGlobal === '2X' && (
                <p className="text-[11px] text-[#A8862E] leading-relaxed">
                  Perhatian: Ada <strong>{affectedCount} barang DICETAK</strong> yang akan berstatus &ldquo;menunggu konfirmasi fisik&rdquo; sebelum dapat dikeluarkan.
                </p>
              )}
            </div>

            {/* Tombol Aksi Modal */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="h-11 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] text-xs font-semibold text-[#2C3E50] cursor-pointer active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isScanModeLoading}
                onClick={handleConfirmSave}
                className="h-11 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] text-white text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                {isScanModeLoading ? 'Menyimpan...' : 'Ya, Terapkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  Plus
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { apiPost, apiPut } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'
import { PERMISSION_MODULES } from '../../utils/rbac'

const ROLE_AREAS = [
  {
    id: 'prod1',
    name: 'Produksi 1',
    features: ['plan', 'barcode', 'ppic_recap', 'inbound', 'outbound', 'inventory', 'meat', 'seasoning', 'wrapper', 'sauce']
  },
  {
    id: 'prod2',
    name: 'Produksi 2 & Gudang',
    features: ['prod2_assembly', 'prod2_packing', 'freezer_sales', 'scan']
  },
  {
    id: 'reports',
    name: 'Laporan & Penelusuran',
    features: ['logs']
  },
  {
    id: 'admin',
    name: 'Administrasi',
    features: ['admin_users', 'admin_roles', 'admin_audit_logs']
  }
]

export default function AdminRoleFormPage({
  mode = 'create', // 'create' | 'edit' | 'duplicate'
  targetId = null,
  roles = [],
  onReloadRoles
}) {
  const closeAdminForm = useProduction1Store((s) => s.closeAdminForm)
  const setActionFeedback = (fb) => useProduction1Store.setState({ actionFeedback: fb })

  const isEdit = mode === 'edit' && Boolean(targetId)
  const isDuplicate = mode === 'duplicate' && Boolean(targetId)

  // Ref untuk scroll ke field error pertama
  const roleNameRef = useRef(null)

  // Target role data
  const targetRole = useMemo(() => {
    if (!targetId) return null
    return roles.find((r) => r.id === Number(targetId)) || null
  }, [roles, targetId])

  const isSystemRole = Boolean(targetRole?.is_system && targetRole?.name === 'Super Admin')

  // Inisialisasi data role langsung saat mount
  const initialData = useMemo(() => {
    if ((isEdit || isDuplicate) && targetRole) {
      return {
        roleName: isDuplicate ? `${targetRole.name} (Salinan)` : targetRole.name,
        description: targetRole.description || '',
        permissions: new Set(targetRole.permissions || [])
      }
    }
    return {
      roleName: '',
      description: '',
      permissions: new Set()
    }
  }, [isEdit, isDuplicate, targetRole])

  // Form Fields
  const [roleName, setRoleName] = useState(() => initialData.roleName)
  const [roleNameError, setRoleNameError] = useState('')
  const [description, setDescription] = useState(() => initialData.description)
  const [showDescription, setShowDescription] = useState(() => Boolean(initialData.description))
  const [selectedPermissions, setSelectedPermissions] = useState(() => initialData.permissions)

  // Accordion & Search State
  const [searchPage, setSearchPage] = useState('')
  const [collapsedAreas, setCollapsedAreas] = useState(new Set())
  const [expandedModule, setExpandedModule] = useState(null) // Accordion: hanya SATU baris yang terbuka

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Dialogs
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showConfirmAffectedAccounts, setShowConfirmAffectedAccounts] = useState(false)

  // Baseline untuk deteksi perubahan (Unsaved Changes Guard)
  const [baseline] = useState(() => ({
    roleName: initialData.roleName,
    description: initialData.description,
    permissions: Array.from(initialData.permissions).sort().join(',')
  }))

  // Deteksi dirty (perubahan belum disimpan)
  const isDirty = useMemo(() => {
    if (!baseline || isSystemRole) return false
    if (roleName !== baseline.roleName) return true
    if (description !== baseline.description) return true

    const currentPerms = Array.from(selectedPermissions).sort().join(',')
    if (currentPerms !== baseline.permissions) return true

    return false
  }, [roleName, description, selectedPermissions, isSystemRole, baseline])

  // Browser Back & Popstate Guard
  useEffect(() => {
    const handlePopState = () => {
      if (isDirty) {
        setShowDiscardDialog(true)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isDirty])

  // "Salin dari" dropdown handler
  const handleCopyFromRole = (e) => {
    const sourceRoleId = e.target.value
    if (!sourceRoleId) return

    const sourceRole = roles.find((r) => r.id === Number(sourceRoleId))
    if (sourceRole && Array.isArray(sourceRole.permissions)) {
      setSelectedPermissions(new Set(sourceRole.permissions))
      setActionFeedback({
        type: 'info',
        message: `Izin disalin dari role '${sourceRole.name}'.`
      })
    }
    e.target.value = ''
  }

  // Toggle Ciutkan/Buka Area Group
  const toggleAreaCollapse = (areaId) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }

  // Helper izin per modul
  const getModulePermissionCodes = (mod) => mod.actions.map((a) => a.code)
  const getViewPermission = (mod) => mod.viewPerm || mod.actions.find((a) => a.type === 'view')?.code

  // Aturan Halaman & Aksi:
  // 1. Menyalakan halaman (switch ON): otomatis menyalakan "Lihat" dan buka baris
  // 2. Mematikan halaman (switch OFF): hapus semua izin modul dan tutup baris jika sedang buka
  const toggleModulePage = (mod, isCurrentlyActive) => {
    if (isSystemRole) return

    const viewCode = getViewPermission(mod)
    const modCodes = getModulePermissionCodes(mod)

    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (isCurrentlyActive) {
        // Matikan seluruh modul
        modCodes.forEach((c) => next.delete(c))
      } else {
        // Nyalakan modul -> minimal viewPerm aktif
        if (viewCode) next.add(viewCode)
      }
      return next
    })

    if (!isCurrentlyActive) {
      // Auto buka accordion jika baru dinyalakan
      setExpandedModule(mod.feature)
    } else if (expandedModule === mod.feature) {
      setExpandedModule(null)
    }
  }

  // Aturan Aksi Chip:
  // - Mengetuk "Semua": toggle semua aksi modul
  // - Mengetuk "Lihat": jika dimatikan, seluruh halaman mati; jika dinyalakan, tambah view
  // - Mengetuk aksi lain: otomatis memastikan "Lihat" aktif
  const toggleActionChip = (mod, actionCode) => {
    if (isSystemRole) return

    const viewCode = getViewPermission(mod)

    setSelectedPermissions((prev) => {
      const next = new Set(prev)

      if (actionCode === viewCode) {
        if (next.has(viewCode)) {
          // Mematikan Lihat = mematikan halaman (hapus semua aksi modul)
          getModulePermissionCodes(mod).forEach((c) => next.delete(c))
          if (expandedModule === mod.feature) {
            setExpandedModule(null)
          }
        } else {
          next.add(viewCode)
        }
      } else {
        // Aksi non-lihat
        if (next.has(actionCode)) {
          next.delete(actionCode)
          // Jika mematikan Lihat Harga, otomatis matikan Ubah Harga
          if (actionCode === 'freezer_sales:view_price') {
            next.delete('freezer_sales:edit_price')
          }
        } else {
          next.add(actionCode)
          // Aksi lain BUTUH Lihat
          if (viewCode) next.add(viewCode)
          // "Ubah Harga" otomatis menyalakan "Lihat Harga"
          if (actionCode === 'freezer_sales:edit_price') {
            next.add('freezer_sales:view_price')
          }
        }
      }

      return next
    })
  }

  const toggleAllModuleActions = (mod) => {
    if (isSystemRole) return

    const allCodes = getModulePermissionCodes(mod)
    const allSelected = allCodes.every((c) => selectedPermissions.has(c))
    const viewCode = getViewPermission(mod)

    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Turunkan ke hanya "Lihat"
        allCodes.forEach((c) => {
          if (c !== viewCode) next.delete(c)
        })
      } else {
        allCodes.forEach((c) => next.add(c))
      }
      return next
    })
  }

  // Filter modul per halaman berdasarkan input pencarian
  const searchClean = searchPage.trim().toLowerCase()
  const filteredModulesMap = useMemo(() => {
    const map = new Map()
    PERMISSION_MODULES.forEach((m) => {
      const match =
        !searchClean ||
        m.title.toLowerCase().includes(searchClean) ||
        (m.description || '').toLowerCase().includes(searchClean) ||
        m.actions.some((a) => a.label.toLowerCase().includes(searchClean))
      if (match) {
        map.set(m.feature, m)
      }
    })
    return map
  }, [searchClean])

  // Perhitungan Ringkasan Hak Akses: {N} halaman • {M} izin
  const accessiblePagesCount = useMemo(() => {
    let count = 0
    PERMISSION_MODULES.forEach((mod) => {
      const hasAny = mod.actions.some((a) => selectedPermissions.has(a.code))
      if (hasAny) count++
    })
    return count
  }, [selectedPermissions])

  const totalPermissionsCount = selectedPermissions.size

  // Back Button Click Handler
  const handleBackClick = () => {
    if (isDirty) {
      setShowDiscardDialog(true)
    } else {
      closeAdminForm()
    }
  }

  // Submit Handler dengan Auto-Scroll ke Error Pertama
  const handleSaveClick = (e) => {
    e?.preventDefault()
    setErrorMessage('')

    if (isSystemRole) {
      setErrorMessage('Role sistem tidak dapat diubah.')
      return
    }

    if (!roleName.trim()) {
      setRoleNameError('Wajib diisi')
      roleNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      roleNameRef.current?.focus()
      return
    }

    // Jika mode edit dan role digunakan oleh N akun, konfirmasi dampak
    const userCount = targetRole?.user_count || 0
    if (isEdit && userCount > 0) {
      setShowConfirmAffectedAccounts(true)
      return
    }

    executeSave()
  }

  const executeSave = async () => {
    setShowConfirmAffectedAccounts(false)
    try {
      setIsSubmitting(true)
      const payload = {
        name: roleName.trim(),
        description: description.trim() || null,
        permission_codes: Array.from(selectedPermissions)
      }

      if (isEdit) {
        await apiPut(`/admin/roles/${targetId}`, payload)
        setActionFeedback({
          type: 'success',
          message: `Role '${payload.name}' disimpan.`
        })
      } else {
        await apiPost('/admin/roles', payload)
        setActionFeedback({
          type: 'success',
          message: `Role '${payload.name}' dibuat.`
        })
      }

      if (onReloadRoles) onReloadRoles()
      closeAdminForm()
    } catch (err) {
      console.error('Failed to save role:', err)
      setErrorMessage(err.message || 'Gagal menyimpan role.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const titleText = isSystemRole
    ? 'Detail Role'
    : isDuplicate
    ? 'Duplikat Role'
    : isEdit
    ? 'Edit Role'
    : 'Role Baru'

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex flex-col min-h-screen min-h-[100dvh] bg-[var(--canvas)] select-text relative">
      {/* Header Halaman: Tombol Kembali (←) + Judul Pendek (Tanpa Subjudul) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#EDE8DF] px-3.5 py-2 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBackClick}
            aria-label="Kembali"
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-[#2C3E50] hover:bg-[#F5F1EB] active:bg-[#EDE8DF] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#2C3E50]">{titleText}</h1>
            {isSystemRole && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                <Lock className="w-3 h-3" />
                <span>Terkunci</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Banner Peringatan Role Sistem */}
      {isSystemRole && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Role sistem Super Admin bersifat baku dan tidak dapat diubah.</span>
        </div>
      )}

      {/* Pesan Kesalahan Global */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Body - Single Scroll Area */}
      <form onSubmit={handleSaveClick} className="flex-1 px-4 py-4 space-y-4 pb-36">
        {/* 1. NAMA ROLE & SALIN DARI */}
        <div className="space-y-3">
          <div>
            <label htmlFor="field-rolename" className="text-xs font-bold text-[#2C3E50] block mb-1.5">
              Nama Role
            </label>
            <input
              id="field-rolename"
              ref={roleNameRef}
              type="text"
              required
              disabled={isSystemRole}
              autoCapitalize="words"
              enterKeyHint="next"
              value={roleName}
              onChange={(e) => {
                setRoleName(e.target.value)
                if (roleNameError) setRoleNameError('')
              }}
              placeholder="Contoh: Operator Daging"
              className={`w-full min-h-[48px] h-12 px-3.5 bg-white border rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors disabled:bg-[#F8FAFC] disabled:cursor-not-allowed ${
                roleNameError
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
              }`}
            />
            {roleNameError && (
              <p className="text-xs text-red-600 mt-1 font-medium">{roleNameError}</p>
            )}
          </div>

          {/* Salin dari (Opsional) */}
          {!isSystemRole && roles.length > 0 && (
            <div>
              <label htmlFor="field-copyfrom" className="text-xs font-bold text-[#64748B] block mb-1.5">
                Salin dari
              </label>
              <select
                id="field-copyfrom"
                defaultValue=""
                onChange={handleCopyFromRole}
                className="w-full min-h-[48px] h-12 px-3.5 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Salin dari role lain...</option>
                {roles
                  .filter((r) => !targetId || r.id !== Number(targetId))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({(r.permissions || []).length} izin)
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Deskripsi (Disembunyikan di balik toggle "+ Deskripsi") */}
          {!showDescription ? (
            <button
              type="button"
              disabled={isSystemRole}
              onClick={() => setShowDescription(true)}
              className="text-xs font-bold text-[#3A6B80] hover:text-[#2D5566] flex items-center gap-1 cursor-pointer py-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Deskripsi</span>
            </button>
          ) : (
            <div>
              <label htmlFor="field-roledesc" className="text-xs font-bold text-[#64748B] block mb-1.5">
                Deskripsi
              </label>
              <textarea
                id="field-roledesc"
                rows={2}
                disabled={isSystemRole}
                enterKeyHint="done"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat role ini..."
                className="w-full p-3 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#3A6B80] transition-colors disabled:bg-[#F8FAFC]"
              />
            </div>
          )}
        </div>

        {/* 2. IZIN: INPUT "CARI HALAMAN" */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-bold text-[#2C3E50] block mb-1.5">
              Cari halaman
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                value={searchPage}
                onChange={(e) => setSearchPage(e.target.value)}
                placeholder="Cari halaman"
                className="w-full min-h-[48px] h-12 pl-10 pr-3.5 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 4 KELOMPOK AREA (PRODUKSI 1, PRODUKSI 2 & GUDANG, LAPORAN & PENELUSURAN, ADMINISTRASI) */}
          <div className="space-y-3">
            {ROLE_AREAS.map((area) => {
              const areaModules = area.features
                .map((f) => filteredModulesMap.get(f))
                .filter(Boolean)

              if (areaModules.length === 0) return null

              const isAreaCollapsed = collapsedAreas.has(area.id)

              // Hitung halaman aktif di area ini
              const activeCountInArea = areaModules.filter((mod) =>
                mod.actions.some((a) => selectedPermissions.has(a.code))
              ).length

              return (
                <div
                  key={area.id}
                  className="bg-white border border-[#EDE8DF] rounded-2xl overflow-hidden shadow-2xs"
                >
                  {/* Area Group Header: Collapsible */}
                  <button
                    type="button"
                    onClick={() => toggleAreaCollapse(area.id)}
                    className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#FBF9F5] border-b border-[#EDE8DF]/60 flex items-center justify-between text-left cursor-pointer hover:bg-[#F5F1EB] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2C3E50]">{area.name}</span>
                      <span className="text-[10px] font-semibold text-[#64748B] bg-white px-2 py-0.5 rounded-full border border-[#EDE8DF]">
                        {activeCountInArea}/{areaModules.length} halaman
                      </span>
                    </div>
                    {isAreaCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-[#64748B]" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-[#64748B]" />
                    )}
                  </button>

                  {/* List Baris Halaman di dalam Area */}
                  {!isAreaCollapsed && (
                    <div className="divide-y divide-[#EDE8DF]/70">
                      {areaModules.map((mod) => {
                        const allCodes = getModulePermissionCodes(mod)
                        const activePermsForMod = allCodes.filter((c) => selectedPermissions.has(c))
                        const isModActive = activePermsForMod.length > 0
                        const isExpanded = expandedModule === mod.feature
                        const allSelected = allCodes.every((c) => selectedPermissions.has(c))
                        const viewCode = getViewPermission(mod)

                        return (
                          <div key={mod.feature} className="transition-colors">
                            {/* Baris Halaman: Nama + Switch + Muted "N izin" saat aktif */}
                            <div
                              onClick={() => {
                                if (isModActive) {
                                  // Accordion: hanya SATU baris yang terbuka pada satu waktu
                                  setExpandedModule(isExpanded ? null : mod.feature)
                                }
                              }}
                              className={`w-full min-h-[48px] px-3.5 py-3 flex items-center justify-between gap-3 ${
                                isModActive
                                  ? 'cursor-pointer hover:bg-[#F0FDF4]/30'
                                  : 'bg-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-[#2C3E50] block truncate">
                                  {mod.title}
                                </span>
                                {mod.description && (
                                  <span className="text-[10px] text-[#64748B] block truncate">
                                    {mod.description}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {isModActive && (
                                  <span className="text-[11px] font-medium text-[#3A6B80]">
                                    {activePermsForMod.length} izin
                                  </span>
                                )}

                                {/* Switch Halaman */}
                                <button
                                  type="button"
                                  disabled={isSystemRole}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleModulePage(mod, isModActive)
                                  }}
                                  aria-label={`Toggle akses ${mod.title}`}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${
                                    isModActive ? 'bg-[#3A6B80]' : 'bg-[#CBD5E1]'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      isModActive ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Accordion Detail Aksi: Toggle Chips Terisi (Hanya SATU baris terbuka) */}
                            <AnimatePresence>
                              {isModActive && isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15, ease: 'easeOut' }}
                                  className="overflow-hidden bg-[#FBF9F5] px-3.5 pb-3.5 pt-2 border-t border-[#EDE8DF]/60"
                                >
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {/* Chip "Semua" */}
                                    {mod.actions.length > 1 && (
                                      <button
                                        type="button"
                                        disabled={isSystemRole}
                                        onClick={() => toggleAllModuleActions(mod)}
                                        className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                                          allSelected
                                            ? 'bg-[#2C3E50] text-white shadow-2xs'
                                            : 'bg-white text-[#556575] border border-[#CBD5E1] hover:bg-[#EDE8DF]'
                                        }`}
                                      >
                                        Semua
                                      </button>
                                    )}

                                    {/* Chips Aksi Modul */}
                                    {mod.actions.map((act) => {
                                      const isActSelected = selectedPermissions.has(act.code)
                                      const isView = act.code === viewCode

                                      return (
                                        <button
                                          key={act.code}
                                          type="button"
                                          disabled={isSystemRole}
                                          onClick={() => toggleActionChip(mod, act.code)}
                                          className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                                            isActSelected
                                              ? 'bg-[#3A6B80] text-white shadow-2xs'
                                              : 'bg-white text-[#556575] border border-[#CBD5E1] hover:bg-[#EDE8DF]'
                                          } ${isView ? 'ring-1 ring-[#3A6B80]/30' : ''}`}
                                        >
                                          {act.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </form>

      {/* Sticky Bottom Bar: "{N} halaman • {M} izin" di kiri, "Simpan" di kanan (Menghormati Safe Area) */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] z-20 shadow-lg flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-bold text-[#2C3E50] block truncate">
            {accessiblePagesCount} halaman • {totalPermissionsCount} izin
          </span>
          <span className="text-[10px] text-[#64748B] block truncate">
            {isSystemRole ? 'Terkunci' : 'Izin aktif'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSubmitting || isSystemRole}
          className="min-h-[48px] h-12 px-6 bg-[#3A6B80] hover:bg-[#2D5566] disabled:bg-[#94A3B8] active:bg-[#1E3B47] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors shrink-0"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <span>Simpan</span>
          )}
        </button>
      </div>

      {/* DIALOG 1: Guard Perubahan Belum Disimpan */}
      <AnimatePresence>
        {showDiscardDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-lg space-y-4 text-center"
            >
              <h3 className="text-sm font-bold text-[#2C3E50]">Buang perubahan?</h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardDialog(false)
                    closeAdminForm()
                  }}
                  className="min-h-[44px] bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Buang
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardDialog(false)}
                  className="min-h-[44px] bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  Lanjut
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG 2: Konfirmasi Perubahan Role yang Digunakan N Akun */}
      <AnimatePresence>
        {showConfirmAffectedAccounts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-lg space-y-4 text-center"
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2C3E50]">Konfirmasi Perubahan</h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Perubahan berlaku untuk {targetRole?.user_count || 0} akun yang menggunakan role ini.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmAffectedAccounts(false)}
                  className="min-h-[44px] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#64748B] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeSave}
                  className="min-h-[44px] bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

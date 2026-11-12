import { useState, useEffect } from 'react'
import {
  Plus,
  Lock,
  ChevronRight,
  MoreVertical,
  Copy,
  Trash2,
  AlertTriangle,
  Shield
} from 'lucide-react'
import { motion } from 'motion/react'
import { apiDelete } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'
import { canAccess } from '../../utils/rbac'

export default function AdminRolesTab({ roles = [], isLoading = false, onReloadRoles }) {
  const openRoleForm = useProduction1Store((s) => s.openRoleForm)
  const currentUser = useProduction1Store((s) => s.currentUser)

  const canCreateRole = canAccess('admin_roles:create', currentUser)
  const canUpdateRole = canAccess('admin_roles:update', currentUser)
  const canDeleteRole = canAccess('admin_roles:delete', currentUser)

  // Delete Confirmation Dialog
  const [deleteDialogTarget, setDeleteDialogTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Card menu dropdown state
  const [openMenuRoleId, setOpenMenuRoleId] = useState(null)

  useEffect(() => {
    if (!openMenuRoleId) return
    const handleClickOutside = () => setOpenMenuRoleId(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [openMenuRoleId])

  const handleConfirmDelete = async () => {
    if (!deleteDialogTarget) return
    try {
      setIsDeleting(true)
      await apiDelete(`/admin/roles/${deleteDialogTarget.id}`)
      useProduction1Store.getState().actionFeedback = {
        type: 'success',
        message: `Role '${deleteDialogTarget.name}' berhasil dihapus.`
      }
      setDeleteDialogTarget(null)
      if (onReloadRoles) onReloadRoles()
    } catch (err) {
      useProduction1Store.getState().actionFeedback = {
        type: 'error',
        message: err.message || 'Gagal menghapus role.'
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Baris 1: Judul Ringkas "Role (N)" + Tombol "+ Baru" */}
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="text-sm font-bold font-heading text-[#2C3E50]">
          Role ({roles.length})
        </h3>

        {canCreateRole && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => openRoleForm('create', null)}
            className="min-h-[40px] px-3.5 py-2 bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Baru</span>
          </motion.button>
        )}
      </div>

      {/* Daftar Kartu Role Ringkas (2 Baris per Kartu, Minimal 5 Role Muat dalam 1 Layar) */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs animate-pulse flex items-center justify-between"
            >
              <div className="space-y-1.5 flex-1">
                <div className="h-4 bg-[#EDE8DF] rounded w-36" />
                <div className="h-3 bg-[#EDE8DF] rounded w-24" />
              </div>
              <div className="w-4 h-4 bg-[#EDE8DF] rounded-full" />
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center my-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center mx-auto text-[#6B7B8D] mb-3">
            <Shield className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-[#2C3E50]">Belum Ada Role</h4>
          <p className="text-xs text-[#6B7B8D] max-w-xs mx-auto mt-1">
            Klik tombol &quot;+ Baru&quot; untuk membuat peran hak akses baru.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => {
            const isMenuOpen = openMenuRoleId === r.id
            const canDelete = !r.is_system && (r.user_count || 0) === 0

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => canUpdateRole && openRoleForm('edit', r.id)}
                className={`bg-white border border-[#EDE8DF] rounded-2xl p-3 sm:p-3.5 shadow-2xs transition-all ${
                  canUpdateRole ? 'cursor-pointer hover:border-[#6A9DB3]/40 active:scale-[0.99]' : ''
                } relative`}
              >
                {/* Baris 1: Nama Role + Ikon Gembok (jika sistem) di kiri; Menu ⋯ + Chevron di kanan */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-[#2C3E50] truncate">
                      {r.name}
                    </span>
                    {r.is_system && (
                      <span title="Role Sistem (Tidak dapat dihapus)">
                        <Lock className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Menu Aksi ⋯ */}
                    {(canCreateRole || (canDelete && canDeleteRole)) && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuRoleId(isMenuOpen ? null : r.id)
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#F5F1EB] transition-colors"
                          title="Opsi Role"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#EDE8DF] rounded-xl shadow-lg z-20 py-1 select-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canCreateRole && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuRoleId(null)
                                  openRoleForm('duplicate', r.id)
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-[#2C3E50] hover:bg-[#F5F1EB] flex items-center gap-2 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-[#3A6B80]" />
                                <span>Duplikat</span>
                              </button>
                            )}

                            {canDelete && canDeleteRole && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuRoleId(null)
                                  setDeleteDialogTarget(r)
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-[#C0392B] hover:bg-[#FDF2F2] flex items-center gap-2 cursor-pointer border-t border-[#EDE8DF]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </div>
                </div>

                {/* Baris 2: Muted Text "N akun • M izin" */}
                <div className="flex items-center gap-1.5 text-xs text-[#6B7B8D] mt-1">
                  <span>{r.user_count || 0} akun</span>
                  <span>•</span>
                  <span>{r.permission_count || (r.permissions || []).length} izin</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog: Delete Custom Role */}
      {deleteDialogTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl border border-[#EDE8DF]"
          >
            <div className="w-10 h-10 rounded-full bg-[#FDF2F2] border border-[#F5C6CB] flex items-center justify-center text-[#C0392B] mb-3">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>

            <h3 className="text-sm font-bold font-heading text-[#2C3E50]">
              Hapus Role Kustom?
            </h3>

            <p className="text-xs text-[#6B7B8D] mt-1.5 leading-relaxed">
              Role <span className="font-bold text-[#2C3E50]">&quot;{deleteDialogTarget.name}&quot;</span> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteDialogTarget(null)}
                disabled={isDeleting}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#556575] hover:bg-[#F5F1EB] rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px] px-5 py-2 bg-[#C0392B] hover:bg-[#A93226] text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  KeyRound,
  Edit2,
  Power,
  Filter,
  AlertTriangle,
  X,
  Users,
  MoreVertical
} from 'lucide-react'
import { motion } from 'motion/react'
import { apiGet, apiPost } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'
import { canAccess } from '../../utils/rbac'
import ResetPasswordModal from './ResetPasswordModal'

function formatLoginTime(dateStr) {
  if (!dateStr) return 'Belum pernah login'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Belum pernah login'

    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()

    const timeStr = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).format(d).replace(':', '.')

    if (isToday) {
      return `Login terakhir ${timeStr}`
    }

    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Jakarta'
    }).format(d)

    return `Login terakhir ${dateFormatted}, ${timeStr}`
  } catch {
    return 'Belum pernah login'
  }
}

export default function AdminUsersTab({ availableRoles = [], onReloadRoles }) {
  const currentUser = useProduction1Store((s) => s.currentUser)
  const openUserForm = useProduction1Store((s) => s.openUserForm)

  const canCreateUser = canAccess('admin_users:create', currentUser)
  const canUpdateUser = canAccess('admin_users:update', currentUser)

  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [roleFilter, setRoleFilter] = useState('ALL')

  const [isResetPwOpen, setIsResetPwOpen] = useState(false)
  const [resetTargetUser, setResetTargetUser] = useState(null)

  // Status Confirmation Dialog
  const [statusDialogTarget, setStatusDialogTarget] = useState(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)

  // Dropdown menu state per card
  const [openMenuUserId, setOpenMenuUserId] = useState(null)

  const fetchUsers = async () => {
    try {
      const data = await apiGet('/admin/users')
      setUsers(data || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
      useProduction1Store.getState().actionFeedback = {
        type: 'error',
        message: err.message || 'Gagal memuat daftar pengguna.'
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    apiGet('/admin/users')
      .then((data) => {
        if (isMounted) setUsers(data || [])
      })
      .catch((err) => {
        console.error('Failed to fetch users:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  // Close card menu on outside click
  useEffect(() => {
    if (!openMenuUserId) return
    const handleClickOutside = () => setOpenMenuUserId(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [openMenuUserId])

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.operator_id?.toLowerCase().includes(q) ||
      u.division?.toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'INACTIVE' && !u.is_active)

    const matchesRole =
      roleFilter === 'ALL' ||
      (u.roles || []).includes(roleFilter)

    return matchesSearch && matchesStatus && matchesRole
  })

  // Toggle User Status
  const handleConfirmToggleStatus = async () => {
    if (!statusDialogTarget) return
    const target = statusDialogTarget
    const nextStatus = !target.is_active

    try {
      setIsStatusChanging(true)
      await apiPost(`/admin/users/${target.id}/status`, { is_active: nextStatus })
      useProduction1Store.getState().actionFeedback = {
        type: 'success',
        message: `Akun '${target.username}' berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
      }
      setStatusDialogTarget(null)
      fetchUsers()
      if (onReloadRoles) onReloadRoles()
    } catch (err) {
      useProduction1Store.getState().actionFeedback = {
        type: 'error',
        message: err.message || 'Gagal mengubah status akun.'
      }
    } finally {
      setIsStatusChanging(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Baris 1: Kolom Cari + Tombol Tambah Ringkas (Maksimal 2 baris kontrol total) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B7B8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, username..."
            className="w-full min-h-[44px] pl-9 pr-8 text-xs bg-white border border-[#EDE8DF] rounded-xl text-[#2C3E50] placeholder:text-[#94A3B8] focus:border-[#3A6B80] focus:outline-none transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {canCreateUser && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => openUserForm('create', null)}
            className="min-h-[44px] px-3.5 py-2 bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah</span>
          </motion.button>
        )}
      </div>

      {/* Baris 2: Chips Status yang Bisa Digeser + Filter Peran */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
        {/* Status Chips */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'ACTIVE', label: 'Aktif' },
            { id: 'INACTIVE', label: 'Nonaktif' }
          ].map((item) => {
            const isSelected = statusFilter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

        {/* Filter Peran Ringkas */}
        <div className="relative shrink-0 flex items-center">
          <Filter className="w-3.5 h-3.5 text-[#6B7B8D] absolute left-2.5 pointer-events-none" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="min-h-[36px] pl-8 pr-6 text-xs bg-white border border-[#EDE8DF] rounded-lg text-[#2C3E50] focus:border-[#3A6B80] focus:outline-none transition-all cursor-pointer shadow-2xs font-medium"
          >
            <option value="ALL">Semua Peran ({availableRoles.length})</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Daftar Kartu Akun (3 Baris Minimalis) */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 shadow-2xs animate-pulse space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-[#EDE8DF] rounded w-32" />
                <div className="w-2.5 h-2.5 bg-[#EDE8DF] rounded-full" />
              </div>
              <div className="h-3 bg-[#EDE8DF] rounded w-48" />
              <div className="h-3 bg-[#EDE8DF] rounded w-28" />
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center my-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center mx-auto text-[#6B7B8D] mb-3">
            <Users className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-[#2C3E50]">Tidak Ada Akun Ditemukan</h4>
          <p className="text-xs text-[#6B7B8D] max-w-xs mx-auto mt-1">
            Coba sesuaikan kata kunci atau filter status dan peran.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((u) => {
            const isSelf = u.id === currentUser?.id
            const isMenuOpen = openMenuUserId === u.id

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => canUpdateUser && openUserForm('edit', u.id)}
                className={`bg-white border rounded-2xl p-3.5 shadow-2xs transition-all ${
                  canUpdateUser ? 'cursor-pointer hover:border-[#6A9DB3]/40 active:scale-[0.99]' : ''
                } relative ${
                  u.is_active ? 'border-[#EDE8DF]' : 'border-[#EDE8DF] bg-[#FAFAFA]'
                }`}
              >
                {/* Baris 1: Nama + Penanda "Anda" di kiri, Titik Status + Menu di kanan */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold text-[#2C3E50] truncate">
                      {u.full_name}
                    </span>
                    {isSelf && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#EEF5F9] text-[#3A6B80] border border-[#6A9DB3]/30 shrink-0">
                        Anda
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Titik Status (Hijau untuk aktif, Abu-abu untuk nonaktif) */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        u.is_active
                          ? 'bg-[#2F7D5B] ring-2 ring-[#EEF7F2]'
                          : 'bg-[#94A3B8] ring-2 ring-[#F1F5F9]'
                      }`}
                      title={u.is_active ? 'Aktif' : 'Nonaktif'}
                    />

                    {/* Menu Aksi Cepat (⋯) */}
                    {canUpdateUser && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuUserId(isMenuOpen ? null : u.id)
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#F5F1EB] transition-colors"
                          title="Opsi Akun"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#EDE8DF] rounded-xl shadow-lg z-20 py-1 select-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuUserId(null)
                                openUserForm('edit', u.id)
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-[#2C3E50] hover:bg-[#F5F1EB] flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#3A6B80]" />
                              <span>Edit Detail</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuUserId(null)
                                setResetTargetUser(u)
                                setIsResetPwOpen(true)
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-[#2C3E50] hover:bg-[#F5F1EB] flex items-center gap-2 cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-[#B25E09]" />
                              <span>Reset Password</span>
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuUserId(null)
                                  setStatusDialogTarget(u)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer border-t border-[#EDE8DF] ${
                                  u.is_active
                                    ? 'text-[#C0392B] hover:bg-[#FDF2F2]'
                                    : 'text-[#2F7D5B] hover:bg-[#EEF7F2]'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Baris 2: @username + Chip Role (2 Chip + "+N") */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-xs text-[#6B7B8D] font-mono">@{u.username}</span>
                  {(u.roles || []).length > 0 && <span className="text-[#EDE8DF]">•</span>}

                  {(u.roles || []).slice(0, 2).map((rname) => (
                    <span
                      key={rname}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F5F1EB] text-[#334155] border border-[#EDE8DF]"
                    >
                      {rname}
                    </span>
                  ))}

                  {(u.roles || []).length > 2 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EEF5F9] text-[#3A6B80] border border-[#6A9DB3]/30">
                      +{u.roles.length - 2}
                    </span>
                  )}

                  {(u.roles || []).length === 0 && (
                    <span className="text-[10px] text-[#94A3B8] italic">Tanpa peran</span>
                  )}
                </div>

                {/* Baris 3: Teks Muted Kecil Login Terakhir */}
                <div className="mt-2 pt-2 border-t border-[#EDE8DF]/60 flex items-center justify-between text-[11px] text-[#6B7B8D]">
                  <span>{formatLoginTime(u.last_login_at)}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog: Toggle User Status */}
      {statusDialogTarget && (
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
            <div className="w-10 h-10 rounded-full bg-[#FFF6EE] border border-[#F3DFC9] flex items-center justify-center text-[#B25E09] mb-3">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>

            <h3 className="text-sm font-bold font-heading text-[#2C3E50]">
              {statusDialogTarget.is_active
                ? `Nonaktifkan akun @${statusDialogTarget.username}?`
                : `Aktifkan akun @${statusDialogTarget.username}?`}
            </h3>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setStatusDialogTarget(null)}
                disabled={isStatusChanging}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#556575] hover:bg-[#F5F1EB] rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={isStatusChanging}
                className={`min-h-[44px] px-5 py-2 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center cursor-pointer ${
                  statusDialogTarget.is_active
                    ? 'bg-[#C0392B] hover:bg-[#A93226]'
                    : 'bg-[#2F7D5B] hover:bg-[#256349]'
                }`}
              >
                {isStatusChanging
                  ? 'Memproses...'
                  : statusDialogTarget.is_active
                  ? 'Ya, Nonaktifkan'
                  : 'Ya, Aktifkan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Reset Password */}
      <ResetPasswordModal
        isOpen={isResetPwOpen}
        onClose={() => {
          setIsResetPwOpen(false)
          setResetTargetUser(null)
        }}
        user={resetTargetUser}
        onSuccess={() => {
          fetchUsers()
        }}
      />
    </div>
  )
}

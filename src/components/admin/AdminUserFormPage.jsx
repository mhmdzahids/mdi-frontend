import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  CheckCircle2,
  Shield,
  X,
  Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { apiGet, apiPost, apiPut } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'

const DIVISIONS = [
  'Divisi Daging (Giling & Mixer)',
  'Divisi Bumbu Racik',
  'Divisi Kulit Pangsit',
  'Divisi Saos Dimsum',
  'Produksi 2: Cetak & Assembly',
  'Produksi 2: Packing & Checker',
  'Gudang Freezer & Sales (POS)',
  'PPIC / Administrasi Produksi',
  'Supervisor & Manajemen',
  'Kantor Manajemen Pusat'
]

function generateReadablePassword() {
  const words = ['Dimsum', 'Baozi', 'Siomay', 'Hakau', 'Wonton', 'Gyoza', 'Mantau', 'Spring', 'Lumpia', 'Kukus']
  const randomWord = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  const specials = ['#', '!', '@', '$']
  const special = specials[Math.floor(Math.random() * specials.length)]
  return `${randomWord}${special}${num}`
}

export default function AdminUserFormPage({
  mode = 'create',
  targetId = null,
  availableRoles = [],
  onReloadRoles
}) {
  const closeAdminForm = useProduction1Store((s) => s.closeAdminForm)
  const setActionFeedback = (fb) => useProduction1Store.setState({ actionFeedback: fb })
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isCurrentSuperAdmin = Boolean(currentUser?.is_superadmin)

  const isEdit = mode === 'edit' && Boolean(targetId)

  // Input Refs untuk scroll ke error pertama
  const fullNameRef = useRef(null)
  const usernameRef = useRef(null)
  const passwordRef = useRef(null)

  // Data Loading
  const [isLoadingUser, setIsLoadingUser] = useState(isEdit)
  const [existingUsers, setExistingUsers] = useState([])

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [isUsernameEdited, setIsUsernameEdited] = useState(false)
  const [password, setPassword] = useState(() => (isEdit ? '' : generateReadablePassword()))
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRoleIds, setSelectedRoleIds] = useState([])
  const [roleSearch, setRoleSearch] = useState('')

  // Info Multi-Role Popover
  const [showRoleInfo, setShowRoleInfo] = useState(false)

  // "Lainnya" section
  const [isLainnyaOpen, setIsLainnyaOpen] = useState(false)
  const [operatorId, setOperatorId] = useState('')
  const [division, setDivision] = useState('')

  // Edit specific
  const [isActive, setIsActive] = useState(true)

  // Field Errors (Error singkat di bawah field)
  const [fullNameError, setFullNameError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Dialogs
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showSuperAdminConfirm, setShowSuperAdminConfirm] = useState(false)
  const [pendingSuperAdminToggle, setPendingSuperAdminToggle] = useState(null)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  // Success Screen (Setelah Akun Baru Dibuat)
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [isCopied, setIsCopied] = useState(false)

  // Reset Password State (Mode Edit)
  const [resetPwLoading, setResetPwLoading] = useState(false)
  const [resetPwSuccess, setResetPwSuccess] = useState(null)
  const [isResetCopied, setIsResetCopied] = useState(false)

  // Baseline untuk deteksi perubahan (Unsaved Changes Guard)
  const [baseline, setBaseline] = useState(null)

  // Ambil daftar users untuk inline availability check & data user jika mode edit
  useEffect(() => {
    let isMounted = true
    apiGet('/admin/users')
      .then((users) => {
        if (!isMounted) return
        setExistingUsers(users || [])
        if (isEdit && targetId) {
          const found = (users || []).find((u) => u.id === Number(targetId))
          if (found) {
            setFullName(found.full_name || '')
            setUsername(found.username || '')
            setIsUsernameEdited(true)
            setOperatorId(found.operator_id || '')
            setDivision(found.division || '')
            setIsActive(Boolean(found.is_active))

            // Map user role names to available role IDs
            const roleIds = availableRoles
              .filter((r) => (found.roles || []).includes(r.name))
              .map((r) => r.id)
            setSelectedRoleIds(roleIds)

            if (found.operator_id || found.division) {
              setIsLainnyaOpen(true)
            }

            setBaseline({
              fullName: found.full_name || '',
              username: found.username || '',
              operatorId: found.operator_id || '',
              division: found.division || '',
              isActive: Boolean(found.is_active),
              roleIds: [...roleIds].sort()
            })
          }
        } else {
          setBaseline({
            fullName: '',
            username: '',
            operatorId: '',
            division: '',
            isActive: true,
            roleIds: []
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load user:', err)
        setErrorMessage('Gagal memuat data akun.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingUser(false)
      })

    return () => {
      isMounted = false
    }
  }, [isEdit, targetId, availableRoles])

  // Deteksi dirty (perubahan belum disimpan)
  const isDirty = useMemo(() => {
    if (!baseline || createdCredentials) return false
    if (fullName !== baseline.fullName) return true
    if (username !== baseline.username) return true
    if (!isEdit && password.length > 0) return true
    if (operatorId !== baseline.operatorId) return true
    if (division !== baseline.division) return true
    if (isEdit && isActive !== baseline.isActive) return true

    const currentSorted = [...selectedRoleIds].sort().join(',')
    const baseSorted = [...baseline.roleIds].sort().join(',')
    if (currentSorted !== baseSorted) return true

    return false
  }, [fullName, username, password, operatorId, division, isActive, selectedRoleIds, isEdit, createdCredentials, baseline])

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

  // Auto-suggest Username dari Nama jika belum diedit manual
  const handleFullNameChange = (e) => {
    const val = e.target.value
    setFullName(val)
    if (fullNameError) setFullNameError('')
    if (!isEdit && !isUsernameEdited) {
      const suggested = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
      setUsername(suggested)
      if (usernameError) setUsernameError('')
    }
  }

  const handleUsernameChange = (e) => {
    setIsUsernameEdited(true)
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(val)
    if (usernameError) setUsernameError('')
  }

  // Inline Username Availability Check
  const usernameCheck = useMemo(() => {
    const clean = username.trim().toLowerCase()
    if (!clean) return { status: 'idle', message: '' }
    if (clean.length < 3) return { status: 'error', message: 'Minimal 3 karakter' }

    const isDuplicate = existingUsers.some(
      (u) => u.username.toLowerCase() === clean && (!isEdit || u.id !== Number(targetId))
    )
    if (isDuplicate) {
      return { status: 'error', message: 'Username sudah dipakai' }
    }
    return { status: 'success', message: 'Tersedia' }
  }, [username, existingUsers, isEdit, targetId])

  // Role Selection Logic: Hanya Super Admin yang berhak melihat dan menetapkan role Super Admin
  const visibleAvailableRoles = useMemo(() => {
    if (isCurrentSuperAdmin) return availableRoles
    return availableRoles.filter(
      (r) => r.name !== 'Super Admin' && !r.is_superadmin
    )
  }, [availableRoles, isCurrentSuperAdmin])

  const superAdminRole = useMemo(() => {
    if (!isCurrentSuperAdmin) return null
    return availableRoles.find((r) => r.is_system && r.name === 'Super Admin')
  }, [availableRoles, isCurrentSuperAdmin])

  const toggleRole = (roleId) => {
    const isCurrentlySelected = selectedRoleIds.includes(roleId)
    const isTargetSuperAdmin = superAdminRole && superAdminRole.id === roleId

    if (!isCurrentSuperAdmin && isTargetSuperAdmin) {
      return
    }

    if (!isCurrentlySelected && isTargetSuperAdmin) {
      setPendingSuperAdminToggle(roleId)
      setShowSuperAdminConfirm(true)
      return
    }

    if (isCurrentlySelected) {
      setSelectedRoleIds((prev) => prev.filter((id) => id !== roleId))
    } else {
      setSelectedRoleIds((prev) => [...prev, roleId])
    }
  }

  const confirmSuperAdminSelection = () => {
    if (pendingSuperAdminToggle && isCurrentSuperAdmin) {
      setSelectedRoleIds((prev) => [...prev, pendingSuperAdminToggle])
      setPendingSuperAdminToggle(null)
    }
    setShowSuperAdminConfirm(false)
  }

  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return visibleAvailableRoles
    const q = roleSearch.toLowerCase()
    return visibleAvailableRoles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    )
  }, [visibleAvailableRoles, roleSearch])

  // Back Button Click Handler dengan Unsaved Changes Guard
  const handleBackClick = () => {
    if (isDirty) {
      setShowDiscardDialog(true)
    } else {
      closeAdminForm()
    }
  }

  // Submit Handler dengan Auto-Scroll ke Error Pertama
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    // Validasi Nama
    if (!fullName.trim()) {
      setFullNameError('Wajib diisi')
      fullNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      fullNameRef.current?.focus()
      return
    }

    // Validasi Username
    if (!username.trim()) {
      setUsernameError('Wajib diisi')
      usernameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      usernameRef.current?.focus()
      return
    }
    if (username.length < 3) {
      setUsernameError('Minimal 3 karakter')
      usernameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      usernameRef.current?.focus()
      return
    }
    if (usernameCheck.status === 'error') {
      setUsernameError(usernameCheck.message)
      usernameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      usernameRef.current?.focus()
      return
    }

    // Validasi Password (hanya pada pembuatan akun)
    if (!isEdit && (!password || password.length < 6)) {
      setPasswordError('Minimal 6 karakter')
      passwordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      passwordRef.current?.focus()
      return
    }

    const hasSuperAdminRole = isCurrentSuperAdmin && superAdminRole && selectedRoleIds.includes(superAdminRole.id)
    const safeRoleIds = isCurrentSuperAdmin
      ? selectedRoleIds
      : selectedRoleIds.filter((id) => !superAdminRole || id !== superAdminRole.id)

    try {
      setIsSubmitting(true)
      if (isEdit) {
        await apiPut(`/admin/users/${targetId}`, {
          full_name: fullName.trim(),
          operator_id: operatorId.trim() || null,
          division: division || null,
          is_active: isActive,
          is_superadmin: Boolean(hasSuperAdminRole),
          role_ids: safeRoleIds
        })

        if (onReloadRoles) onReloadRoles()
        setActionFeedback({ type: 'success', message: 'Perubahan akun disimpan.' })
        closeAdminForm()
      } else {
        const newUser = await apiPost('/admin/users', {
          full_name: fullName.trim(),
          username: username.trim().toLowerCase(),
          password: password,
          operator_id: operatorId.trim() || null,
          division: division || null,
          is_active: true,
          is_superadmin: Boolean(hasSuperAdminRole),
          must_change_password: true,
          role_ids: safeRoleIds
        })

        if (onReloadRoles) onReloadRoles()
        setCreatedCredentials({
          username: newUser.username,
          password: password,
          fullName: newUser.full_name
        })
      }
    } catch (err) {
      console.error('Failed to save user:', err)
      setErrorMessage(err.message || 'Gagal menyimpan akun.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Salin Kredensial Akun Baru
  const handleCopyCredentials = () => {
    if (!createdCredentials) return
    const text = `Kredensial MDI Dimsum MES\nNama: ${createdCredentials.fullName}\nUsername: ${createdCredentials.username}\nPassword Sementara: ${createdCredentials.password}`
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    })
  }

  // Reset Password (Mode Edit)
  const handleResetPassword = async () => {
    const newPw = generateReadablePassword()
    try {
      setResetPwLoading(true)
      setResetPwSuccess(null)
      await apiPost(`/admin/users/${targetId}/reset-password`, {
        new_password: newPw,
        must_change_password: true
      })
      setResetPwSuccess(newPw)
    } catch (err) {
      alert(`Gagal reset password: ${err.message}`)
    } finally {
      setResetPwLoading(false)
    }
  }

  // Layar Sukses Akun Baru Dibuat (Tampil Sekali)
  if (createdCredentials) {
    return (
      <div className="w-full max-w-md md:max-w-xl mx-auto min-h-screen min-h-[100dvh] bg-[var(--canvas)] flex flex-col justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-white border border-[#EDE8DF] rounded-2xl p-6 shadow-sm text-center space-y-5"
        >
          <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div>
            <h2 className="text-base font-bold text-[#2C3E50]">Akun Berhasil Dibuat</h2>
            <p className="text-xs text-[#64748B] mt-1">
              Password hanya tampil sekali.
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-left space-y-3">
            <div>
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">Username</span>
              <span className="font-mono text-sm font-bold text-[#2C3E50]">@{createdCredentials.username}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">Password</span>
              <span className="font-mono text-base font-extrabold text-[#3A6B80] tracking-wide select-all">
                {createdCredentials.password}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="min-h-[48px] h-12 w-full bg-[#EEF5F9] hover:bg-[#D1E4EF] active:bg-[#BCE3CF] text-[#3A6B80] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>{isCopied ? 'Tersalin' : 'Salin Kredensial'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActionFeedback({ type: 'success', message: `Akun @${createdCredentials.username} siap digunakan.` })
                closeAdminForm()
              }}
              className="min-h-[48px] h-12 w-full bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            >
              Selesai
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (isLoadingUser) {
    return (
      <div className="w-full max-w-md md:max-w-xl mx-auto min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#3A6B80] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex flex-col min-h-screen min-h-[100dvh] bg-[var(--canvas)] select-text relative">
      {/* Header Halaman Khusus: Tombol Kembali (←) + Judul Pendek (Tanpa Subjudul) */}
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
          <h1 className="text-base font-bold text-[#2C3E50]">
            {isEdit ? 'Edit Akun' : 'Akun Baru'}
          </h1>
        </div>
      </header>

      {/* Pesan Kesalahan Global */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Body - Single Scroll Area */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4 pb-36">
        {/* 1. NAMA */}
        <div>
          <label htmlFor="field-fullname" className="text-xs font-bold text-[#2C3E50] block mb-1.5">
            Nama
          </label>
          <input
            id="field-fullname"
            ref={fullNameRef}
            type="text"
            required
            autoCapitalize="words"
            autoComplete="name"
            enterKeyHint="next"
            value={fullName}
            onChange={handleFullNameChange}
            placeholder="Contoh: Budi Santoso"
            className={`w-full min-h-[48px] h-12 px-3.5 bg-white border rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
              fullNameError
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
            }`}
          />
          {fullNameError && (
            <p className="text-xs text-red-600 mt-1 font-medium">{fullNameError}</p>
          )}
        </div>

        {/* 2. USERNAME */}
        <div>
          <label htmlFor="field-username" className="text-xs font-bold text-[#2C3E50] block mb-1.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#94A3B8]">@</span>
            <input
              id="field-username"
              ref={usernameRef}
              type="text"
              required
              disabled={isEdit}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              enterKeyHint="next"
              value={username}
              onChange={handleUsernameChange}
              placeholder="budisantoso"
              className={`w-full min-h-[48px] h-12 pl-8 pr-10 bg-white border rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                isEdit
                  ? 'bg-[#F8FAFC] text-[#64748B] border-[#EDE8DF] cursor-not-allowed'
                  : usernameError || usernameCheck.status === 'error'
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : usernameCheck.status === 'success'
                  ? 'border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
              }`}
            />
            {!isEdit && usernameCheck.status === 'success' && (
              <Check className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>
          {!isEdit && (usernameError || usernameCheck.message) && (
            <p
              className={`text-xs mt-1 font-medium ${
                usernameError || usernameCheck.status === 'error' ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {usernameError || usernameCheck.message}
            </p>
          )}
        </div>

        {/* 3. PASSWORD (CREATE) ATAU RESET PASSWORD (EDIT) */}
        {!isEdit ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="field-password" className="text-xs font-bold text-[#2C3E50] block">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateReadablePassword())
                  if (passwordError) setPasswordError('')
                }}
                className="text-xs font-bold text-[#3A6B80] hover:text-[#2D5566] flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-md hover:bg-[#EEF5F9]"
              >
                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Acak ulang</span>
              </button>
            </div>
            <div className="relative">
              <input
                id="field-password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="new-password"
                enterKeyHint="done"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError('')
                }}
                placeholder="Minimal 6 karakter"
                className={`w-full min-h-[48px] h-12 pl-3.5 pr-12 bg-white border rounded-xl text-base font-mono text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                  passwordError
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                className="min-h-[48px] min-w-[48px] absolute right-0 top-0 flex items-center justify-center text-[#94A3B8] hover:text-[#2C3E50] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-red-600 mt-1 font-medium">{passwordError}</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2C3E50]">Password</label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPwLoading}
                className="min-h-[44px] px-3.5 bg-[#EEF5F9] hover:bg-[#D1E4EF] active:bg-[#BCE3CF] text-[#3A6B80] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resetPwLoading ? 'animate-spin' : ''}`} />
                <span>Reset password</span>
              </button>
            </div>

            {/* Banner Password Baru yang direset */}
            {resetPwSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl space-y-2 text-left"
              >
                <span className="text-xs font-bold text-[#166534] block">Password baru dibuat:</span>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-[#BBF7D0]">
                  <span className="font-mono text-sm font-bold text-[#166534] select-all">{resetPwSuccess}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPwSuccess).then(() => {
                        setIsResetCopied(true)
                        setTimeout(() => setIsResetCopied(false), 2000)
                      })
                    }}
                    className="text-xs font-bold text-[#3A6B80] flex items-center gap-1 cursor-pointer py-1 px-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isResetCopied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* 4. ROLE (CHIPS + SEARCH + LIST + ⓘ INFO MULTI-ROLE) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-[#2C3E50]">Role</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoleInfo(!showRoleInfo)}
                  aria-label="Informasi multi-role"
                  className="text-[#64748B] hover:text-[#3A6B80] p-1 rounded-full cursor-pointer transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showRoleInfo && (
                  <div className="absolute left-0 bottom-full mb-1.5 z-30 w-56 p-2.5 bg-[#2C3E50] text-white text-[11px] rounded-xl shadow-lg leading-relaxed">
                    Pegawai dapat memiliki banyak role. Hak akses adalah gabungan seluruh role.
                  </div>
                )}
              </div>
            </div>

            <span className="text-[11px] text-[#64748B]">
              {selectedRoleIds.length} dipilih
            </span>
          </div>

          {/* Chips Role Terpilih */}
          {selectedRoleIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {selectedRoleIds.map((rid) => {
                const rObj = availableRoles.find((r) => r.id === rid)
                if (!rObj) return null
                return (
                  <span
                    key={rid}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EEF5F9] border border-[#6A9DB3]/30 text-[#3A6B80] rounded-xl text-xs font-semibold"
                  >
                    <span>{rObj.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleRole(rid)}
                      aria-label={`Hapus ${rObj.name}`}
                      className="cursor-pointer text-[#3A6B80] hover:text-red-600 p-0.5 -mr-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Kolom Pencarian Role */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder="Cari role"
              className="w-full min-h-[48px] h-12 pl-10 pr-3.5 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors"
            />
          </div>

          {/* Daftar Role dengan Checkbox dan Count Izin Muted */}
          <div className="bg-white border border-[#EDE8DF] rounded-2xl divide-y divide-[#EDE8DF]/70 max-h-60 overflow-y-auto">
            {filteredRoles.map((r) => {
              const isChecked = selectedRoleIds.includes(r.id)
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggleRole(r.id)}
                  className={`w-full min-h-[48px] px-3.5 py-3 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isChecked ? 'bg-[#F0FDF4]/50' : 'hover:bg-[#F5F1EB]/50'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-[#3A6B80] border-[#3A6B80] text-white'
                          : 'border-[#CBD5E1] bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-semibold text-[#2C3E50] block truncate">
                        {r.name}
                      </span>
                      {r.description && (
                        <span className="text-[10px] text-[#64748B] block truncate">
                          {r.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-[#64748B] shrink-0 font-medium">
                    {r.permission_count || (r.permissions || []).length} izin
                  </span>
                </button>
              )
            })}
            {filteredRoles.length === 0 && (
              <div className="p-4 text-center text-xs text-[#64748B]">
                Tidak ada role yang sesuai.
              </div>
            )}
          </div>
        </div>

        {/* 5. "LAINNYA" (COLLAPSIBLE ACCORDION) */}
        <div className="border border-[#EDE8DF] rounded-2xl bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setIsLainnyaOpen(!isLainnyaOpen)}
            className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-[#F5F1EB]/50 transition-colors"
          >
            <span className="text-xs font-bold text-[#2C3E50]">Lainnya</span>
            {isLainnyaOpen ? (
              <ChevronUp className="w-4 h-4 text-[#64748B]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#64748B]" />
            )}
          </button>

          <AnimatePresence>
            {isLainnyaOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="px-4 pb-4 pt-1 space-y-3.5 border-t border-[#EDE8DF]"
              >
                {/* Operator ID */}
                <div>
                  <label htmlFor="field-opid" className="text-xs font-bold text-[#64748B] block mb-1.5">
                    Operator ID
                  </label>
                  <input
                    id="field-opid"
                    type="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    placeholder="Contoh: OPR-01"
                    className="w-full min-h-[48px] h-12 px-3.5 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors"
                  />
                </div>

                {/* Divisi */}
                <div>
                  <label htmlFor="field-division" className="text-xs font-bold text-[#64748B] block mb-1.5">
                    Divisi
                  </label>
                  <select
                    id="field-division"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full min-h-[48px] h-12 px-3.5 bg-white border border-[#EDE8DF] focus:border-[#3A6B80] rounded-xl text-base text-[#2C3E50] focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Pilih Divisi</option>
                    {DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 6. STATUS AKUN (AKTIF / NONAKTIF) PADA MODE EDIT */}
        {isEdit && (
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-[#2C3E50]">Status Akun</span>

            <button
              type="button"
              onClick={() => {
                if (isActive) {
                  setShowDeactivateConfirm(true)
                } else {
                  setIsActive(true)
                }
              }}
              className={`min-h-[44px] min-w-[70px] px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              {isActive ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        )}
      </form>

      {/* Sticky Action Bar di Bawah: Satu Tombol Simpan (Menghormati Safe Area) */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] z-20 shadow-lg">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || usernameCheck.status === 'error'}
          className="min-h-[48px] h-12 w-full bg-[#3A6B80] hover:bg-[#2D5566] disabled:bg-[#94A3B8] active:bg-[#1E3B47] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors"
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

      {/* DIALOG 2: Konfirmasi Pemilihan Role Super Admin */}
      <AnimatePresence>
        {showSuperAdminConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-lg space-y-4 text-center"
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#2C3E50]">Beri akses penuh?</h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuperAdminConfirm(false)
                    setPendingSuperAdminToggle(null)
                  }}
                  className="min-h-[44px] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#64748B] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmSuperAdminSelection}
                  className="min-h-[44px] bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  Ya
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG 3: Konfirmasi Nonaktifkan Akun */}
      <AnimatePresence>
        {showDeactivateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-lg space-y-4 text-center"
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#2C3E50]">
                Nonaktifkan akun @{username}?
              </h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="min-h-[44px] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#64748B] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActive(false)
                    setShowDeactivateConfirm(false)
                  }}
                  className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  Nonaktifkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

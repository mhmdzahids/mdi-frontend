import { useState, useEffect } from 'react'
import { Users, Shield, History, Key, Ticket } from 'lucide-react'
import { motion } from 'motion/react'
import { useProduction1Store } from '../../store/production1Store'
import { apiGet } from '../../utils/api'
import { canAccess } from '../../utils/rbac'
import AdminUsersTab from './AdminUsersTab'
import AdminRolesTab from './AdminRolesTab'
import AdminAuditLogsTab from './AdminAuditLogsTab'
import AdminApiKeysTab from './AdminApiKeysTab'
import AdminUserFormPage from './AdminUserFormPage'
import AdminRoleFormPage from './AdminRoleFormPage'
import PromotionsManagementView from '../promotions/PromotionsManagementView'

export default function AdminView() {
  const activeAdminTab = useProduction1Store((s) => s.activeAdminTab)
  const setActiveAdminTab = useProduction1Store((s) => s.setActiveAdminTab)
  const adminForm = useProduction1Store((s) => s.adminForm)
  const currentUser = useProduction1Store((s) => s.currentUser)

  const canViewUsers = canAccess('admin_users:view', currentUser)
  const canViewRoles = canAccess('admin_roles:view', currentUser)
  const canViewPromotions = canAccess('promotions:view', currentUser)
  const canViewLogs = canAccess('admin_audit_logs:view', currentUser)
  const canViewApiKeys = Boolean(currentUser?.is_superadmin)

  const [roles, setRoles] = useState([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)

  const fetchRoles = async () => {
    try {
      setIsLoadingRoles(true)
      const data = await apiGet('/admin/roles')
      setRoles(data || [])
    } catch (err) {
      console.error('Failed to fetch roles:', err)
    } finally {
      setIsLoadingRoles(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    apiGet('/admin/roles')
      .then((data) => {
        if (isMounted) setRoles(data || [])
      })
      .catch((err) => console.error('Failed to fetch roles:', err))
      .finally(() => {
        if (isMounted) setIsLoadingRoles(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  // Pastikan tab aktif valid sesuai izin; jika tidak, arahkan ke tab pertama yang diizinkan
  useEffect(() => {
    if (activeAdminTab === 'USERS' && !canViewUsers) {
      if (canViewRoles) setActiveAdminTab('ROLES')
      else if (canViewPromotions) setActiveAdminTab('PROMOTIONS')
      else if (canViewLogs) setActiveAdminTab('LOGS')
      else if (canViewApiKeys) setActiveAdminTab('API_KEYS')
    } else if (activeAdminTab === 'ROLES' && !canViewRoles) {
      if (canViewUsers) setActiveAdminTab('USERS')
      else if (canViewPromotions) setActiveAdminTab('PROMOTIONS')
      else if (canViewLogs) setActiveAdminTab('LOGS')
      else if (canViewApiKeys) setActiveAdminTab('API_KEYS')
    } else if (activeAdminTab === 'PROMOTIONS' && !canViewPromotions) {
      if (canViewUsers) setActiveAdminTab('USERS')
      else if (canViewRoles) setActiveAdminTab('ROLES')
      else if (canViewLogs) setActiveAdminTab('LOGS')
      else if (canViewApiKeys) setActiveAdminTab('API_KEYS')
    } else if (activeAdminTab === 'LOGS' && !canViewLogs) {
      if (canViewUsers) setActiveAdminTab('USERS')
      else if (canViewRoles) setActiveAdminTab('ROLES')
      else if (canViewPromotions) setActiveAdminTab('PROMOTIONS')
      else if (canViewApiKeys) setActiveAdminTab('API_KEYS')
    } else if (activeAdminTab === 'API_KEYS' && !canViewApiKeys) {
      if (canViewUsers) setActiveAdminTab('USERS')
      else if (canViewRoles) setActiveAdminTab('ROLES')
      else if (canViewPromotions) setActiveAdminTab('PROMOTIONS')
      else if (canViewLogs) setActiveAdminTab('LOGS')
    }
  }, [activeAdminTab, canViewUsers, canViewRoles, canViewPromotions, canViewLogs, canViewApiKeys, setActiveAdminTab])

  // Jika sedang membuka form halaman khusus (Akun / Role)
  if (adminForm?.type === 'USER') {
    return (
      <AdminUserFormPage
        key={`user-${adminForm.mode}-${adminForm.id || 'new'}`}
        mode={adminForm.mode}
        targetId={adminForm.id}
        availableRoles={roles}
        onReloadRoles={fetchRoles}
      />
    )
  }

  if (adminForm?.type === 'ROLE') {
    return (
      <AdminRoleFormPage
        key={`role-${adminForm.mode}-${adminForm.id || 'new'}`}
        mode={adminForm.mode}
        targetId={adminForm.id}
        roles={roles}
        onReloadRoles={fetchRoles}
      />
    )
  }

  return (
    <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col space-y-3 pb-8 select-text">
      {/* Tab Navigation: Akun | Role | Promosi | Log | API Key */}
      <div className="flex items-center gap-1 bg-[#EDE8DF]/70 p-1 rounded-xl border border-[#EDE8DF] shadow-2xs overflow-x-auto">
        {canViewUsers && (
          <button
            type="button"
            onClick={() => setActiveAdminTab('USERS')}
            className={`min-h-[44px] flex-1 min-w-[70px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeAdminTab === 'USERS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Akun</span>
          </button>
        )}

        {canViewRoles && (
          <button
            type="button"
            onClick={() => setActiveAdminTab('ROLES')}
            className={`min-h-[44px] flex-1 min-w-[70px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeAdminTab === 'ROLES'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Role</span>
          </button>
        )}

        {canViewPromotions && (
          <button
            type="button"
            onClick={() => setActiveAdminTab('PROMOTIONS')}
            className={`min-h-[44px] flex-1 min-w-[70px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeAdminTab === 'PROMOTIONS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span className="hidden sm:inline">Promosi</span>
          </button>
        )}

        {canViewLogs && (
          <button
            type="button"
            onClick={() => setActiveAdminTab('LOGS')}
            className={`min-h-[44px] flex-1 min-w-[70px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeAdminTab === 'LOGS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Log</span>
          </button>
        )}

        {canViewApiKeys && (
          <button
            type="button"
            onClick={() => setActiveAdminTab('API_KEYS')}
            className={`min-h-[44px] flex-1 min-w-[70px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeAdminTab === 'API_KEYS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">API Key</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeAdminTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full flex-1 pt-1"
      >
        {activeAdminTab === 'USERS' && canViewUsers && (
          <AdminUsersTab availableRoles={roles} onReloadRoles={fetchRoles} />
        )}
        {activeAdminTab === 'ROLES' && canViewRoles && (
          <AdminRolesTab roles={roles} isLoading={isLoadingRoles} onReloadRoles={fetchRoles} />
        )}
        {activeAdminTab === 'PROMOTIONS' && canViewPromotions && <PromotionsManagementView />}
        {activeAdminTab === 'LOGS' && canViewLogs && <AdminAuditLogsTab />}
        {activeAdminTab === 'API_KEYS' && canViewApiKeys && <AdminApiKeysTab />}
      </motion.div>
    </div>
  )
}

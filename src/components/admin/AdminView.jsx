import { useState, useEffect } from 'react'
import { Users, Shield, History, Key } from 'lucide-react'
import { motion } from 'motion/react'
import { useProduction1Store } from '../../store/production1Store'
import { apiGet } from '../../utils/api'
import AdminUsersTab from './AdminUsersTab'
import AdminRolesTab from './AdminRolesTab'
import AdminAuditLogsTab from './AdminAuditLogsTab'
import AdminApiKeysTab from './AdminApiKeysTab'
import AdminUserFormPage from './AdminUserFormPage'
import AdminRoleFormPage from './AdminRoleFormPage'

export default function AdminView() {
  const activeAdminTab = useProduction1Store((s) => s.activeAdminTab)
  const setActiveAdminTab = useProduction1Store((s) => s.setActiveAdminTab)
  const adminForm = useProduction1Store((s) => s.adminForm)

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
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex flex-col space-y-3 pb-8 select-text">
      {/* 4 Tab Navigation: Akun | Role | Log | API Key */}
      <div className="grid grid-cols-4 gap-1 bg-[#EDE8DF]/70 p-1 rounded-xl border border-[#EDE8DF] shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveAdminTab('USERS')}
          className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'USERS'
              ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
              : 'text-[#64748B] hover:text-[#2C3E50]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Akun</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('ROLES')}
          className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'ROLES'
              ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
              : 'text-[#64748B] hover:text-[#2C3E50]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('LOGS')}
          className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'LOGS'
              ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
              : 'text-[#64748B] hover:text-[#2C3E50]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Log</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('API_KEYS')}
          className={`min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeAdminTab === 'API_KEYS'
              ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
              : 'text-[#64748B] hover:text-[#2C3E50]'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Key</span>
        </button>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeAdminTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full flex-1 pt-1"
      >
        {activeAdminTab === 'USERS' && (
          <AdminUsersTab availableRoles={roles} onReloadRoles={fetchRoles} />
        )}
        {activeAdminTab === 'ROLES' && (
          <AdminRolesTab roles={roles} isLoading={isLoadingRoles} onReloadRoles={fetchRoles} />
        )}
        {activeAdminTab === 'LOGS' && <AdminAuditLogsTab />}
        {activeAdminTab === 'API_KEYS' && <AdminApiKeysTab />}
      </motion.div>
    </div>
  )
}

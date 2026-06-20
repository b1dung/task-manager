import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/layout/AppLayout'
import { rolesApi } from '@/api/roles'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { applyTheme } from '@/lib/themes'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { BoardPage } from '@/pages/board/BoardPage'
import { SummaryPage } from '@/pages/summary/SummaryPage'
import { CalendarPage } from '@/pages/calendar/CalendarPage'
import { TeamPage } from '@/pages/team/TeamPage'
import { RolesPermissionsPage } from '@/pages/roles/RolesPermissionsPage'
import { UserManagementPage } from '@/pages/users/UserManagementPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { DeveloperReportPage } from '@/pages/reports/DeveloperReportPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { ActivityPage } from '@/pages/activity/ActivityPage'
import { AttachmentsPage } from '@/pages/attachments/AttachmentsPage'
import { AccountPage } from '@/pages/account/AccountPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Route guard: only render children if the user holds the given permission.
 * Backend enforces this too — this just avoids showing forbidden pages. */
function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'permissions'],
    queryFn: rolesApi.myPermissions,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
  if (isLoading) return null
  if (!data?.permissions.includes(permission)) return <Navigate to="/projects" replace />
  return <>{children}</>
}

export default function App() {
  const { theme } = useUIStore()

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/tasks" element={<BoardPage />} />
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
          <Route path="/projects/:projectId/calendar" element={<CalendarPage />} />
          <Route path="/projects/:projectId/team" element={<TeamPage />} />
          <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
          <Route path="/projects/:projectId/developer-report" element={<DeveloperReportPage />} />
          <Route path="/projects/:projectId/attachments" element={<AttachmentsPage />} />
          <Route path="/projects/:projectId/notifications" element={<NotificationsPage />} />
          <Route path="/projects/:projectId/activity" element={<ActivityPage />} />
          <Route
            path="/roles"
            element={
              <RequirePermission permission="manage_roles">
                <RolesPermissionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/users"
            element={
              <RequirePermission permission="manage_users">
                <UserManagementPage />
              </RequirePermission>
            }
          />
          <Route path="/account" element={<AccountPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

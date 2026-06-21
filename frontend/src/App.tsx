import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/layout/AppLayout'
import { rolesApi } from '@/api/roles'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { applyTheme } from '@/lib/themes'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ManageProjectsPage } from '@/pages/projects/ManageProjectsPage'
import { MyTasksPage } from '@/pages/my-tasks/MyTasksPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
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
import { ArchivedPage } from '@/pages/archived/ArchivedPage'
import { AccountPage } from '@/pages/account/AccountPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function DocumentTitle() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  useEffect(() => {
    const routes: Array<[RegExp, string]> = [
      [/^\/login/, 'auth.login'], [/^\/register/, 'auth.register'], [/^\/account/, 'account.title'],
      [/\/tasks/, 'nav.board'], [/\/calendar/, 'pages.calendar'], [/\/notifications/, 'pages.notifications'],
      [/\/activity/, 'pages.activity'], [/\/developer-report/, 'nav.developerReport'], [/\/reports/, 'pages.reports'], [/\/team/, 'pages.team'],
      [/\/attachments/, 'pages.attachments'], [/\/archived/, 'pages.archived'], [/^\/users/, 'pages.users'],
      [/^\/roles/, 'pages.roles'], [/\/settings/, 'pages.settings'], [/\/summary/, 'pages.summary'],
      [/^\/my-tasks/, 'nav.myTasks'], [/^\/manage-projects/, 'nav.projectManagement'], [/^\/projects/, 'projects.title'],
    ]
    const key = routes.find(([pattern]) => pattern.test(pathname))?.[1]
    document.title = key ? `${t(key)} · ${t('app.name')}` : t('app.name')
  }, [pathname, t])
  return null
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
  const user = useAuthStore((s) => s.user)
  const setTheme = useUIStore((s) => s.setTheme)

  useEffect(() => {
    if (user?.appearance && user.appearance !== theme) setTheme(user.appearance)
    document.documentElement.lang = user?.language ?? 'en'
    if (user?.language && i18n.language !== user.language) void i18n.changeLanguage(user.language)
  }, [user?.id, user?.appearance, user?.language, theme, setTheme])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <DocumentTitle />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/projects/:projectId/tasks" element={<BoardPage />} />
          <Route path="/projects/:projectId/summary" element={<SummaryPage />} />
          <Route path="/projects/:projectId/calendar" element={<CalendarPage />} />
          <Route path="/projects/:projectId/team" element={<TeamPage />} />
          <Route path="/projects/:projectId/reports" element={<RequirePermission permission="view_reports"><ReportsPage /></RequirePermission>} />
          <Route path="/projects/:projectId/developer-report" element={<RequirePermission permission="view_reports"><DeveloperReportPage /></RequirePermission>} />
          <Route path="/projects/:projectId/attachments" element={<AttachmentsPage />} />
          <Route path="/projects/:projectId/archived" element={<RequirePermission permission="approve_task"><ArchivedPage /></RequirePermission>} />
          <Route path="/projects/:projectId/settings" element={<RequirePermission permission="edit_project"><SettingsPage /></RequirePermission>} />
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
          <Route
            path="/manage-projects"
            element={
              <RequirePermission permission="delete_project">
                <ManageProjectsPage />
              </RequirePermission>
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

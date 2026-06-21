import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/layout/AppLayout'
import { rolesApi } from '@/api/roles'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { applyTheme } from '@/lib/themes'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'

function lazyNamed<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] }))
}

const LoginPage = lazyNamed(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyNamed(() => import('@/pages/auth/RegisterPage'), 'RegisterPage')
const OAuthCallbackPage = lazyNamed(() => import('@/pages/auth/OAuthCallbackPage'), 'OAuthCallbackPage')
const ForgotPasswordPage = lazyNamed(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = lazyNamed(() => import('@/pages/auth/ResetPasswordPage'), 'ResetPasswordPage')
const VerifyEmailPage = lazyNamed(() => import('@/pages/auth/VerifyEmailPage'), 'VerifyEmailPage')
const ProjectsPage = lazyNamed(() => import('@/pages/projects/ProjectsPage'), 'ProjectsPage')
const ManageProjectsPage = lazyNamed(() => import('@/pages/projects/ManageProjectsPage'), 'ManageProjectsPage')
const MyTasksPage = lazyNamed(() => import('@/pages/my-tasks/MyTasksPage'), 'MyTasksPage')
const SettingsPage = lazyNamed(() => import('@/pages/settings/SettingsPage'), 'SettingsPage')
const BoardPage = lazyNamed(() => import('@/pages/board/BoardPage'), 'BoardPage')
const SummaryPage = lazyNamed(() => import('@/pages/summary/SummaryPage'), 'SummaryPage')
const CalendarPage = lazyNamed(() => import('@/pages/calendar/CalendarPage'), 'CalendarPage')
const TeamPage = lazyNamed(() => import('@/pages/team/TeamPage'), 'TeamPage')
const RolesPermissionsPage = lazyNamed(() => import('@/pages/roles/RolesPermissionsPage'), 'RolesPermissionsPage')
const UserManagementPage = lazyNamed(() => import('@/pages/users/UserManagementPage'), 'UserManagementPage')
const ReportsPage = lazyNamed(() => import('@/pages/reports/ReportsPage'), 'ReportsPage')
const DeveloperReportPage = lazyNamed(() => import('@/pages/reports/DeveloperReportPage'), 'DeveloperReportPage')
const NotificationsPage = lazyNamed(() => import('@/pages/notifications/NotificationsPage'), 'NotificationsPage')
const ActivityPage = lazyNamed(() => import('@/pages/activity/ActivityPage'), 'ActivityPage')
const AttachmentsPage = lazyNamed(() => import('@/pages/attachments/AttachmentsPage'), 'AttachmentsPage')
const ArchivedPage = lazyNamed(() => import('@/pages/archived/ArchivedPage'), 'ArchivedPage')
const AccountPage = lazyNamed(() => import('@/pages/account/AccountPage'), 'AccountPage')

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
    <Suspense fallback={<div className="min-h-full grid place-items-center text-sm text-fg-muted">Loading…</div>}>
    <BrowserRouter>
      <DocumentTitle />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

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
    </Suspense>
    </ErrorBoundary>
  )
}

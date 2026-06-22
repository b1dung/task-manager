import { test, expect } from '@playwright/test'

test('Laravel board receives task updates through Reverb', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@taskboard.dev')
  await page.locator('input[type="password"]').fill('password123')

  const loginResponsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST')
  await page.locator('button[type="submit"]').click()
  const loginPayload = await (await loginResponsePromise).json()
  const token = loginPayload.data.accessToken as string
  await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 })

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const projectResponse = await page.request.post('/api/v1/projects', { headers, data: { name: `E2E Realtime ${Date.now()}` } })
  expect(projectResponse.ok()).toBeTruthy()
  const projectId = (await projectResponse.json()).data.id as string
  const columns = (await (await page.request.get(`/api/v1/projects/${projectId}/columns`, { headers })).json()).data
  const columnId = columns[0].id as string

  await page.request.post(`/api/v1/projects/${projectId}/tasks`, { headers, data: { columnId, title: 'Initial Laravel Task' } })
  await page.goto(`/projects/${projectId}/tasks`)
  await expect(page.getByText('Initial Laravel Task')).toBeVisible({ timeout: 10_000 })

  await page.request.post(`/api/v1/projects/${projectId}/tasks`, { headers, data: { columnId, title: 'Realtime Laravel Task' } })
  await expect(page.getByText('Realtime Laravel Task')).toBeVisible({ timeout: 10_000 })
})

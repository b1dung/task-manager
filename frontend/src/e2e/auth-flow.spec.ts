import { test, expect } from '@playwright/test'

test.describe('Auth Flow', () => {
  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/mật khẩu/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('wrong@email.com')
    await page.getByLabel(/mật khẩu/i).fill('wrongpassword')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await expect(page.getByText(/không đúng|sai|lỗi|invalid/i)).toBeVisible({ timeout: 5000 })
  })

  test('logs in with valid credentials and redirects', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/mật khẩu/i).fill('Admin@123456')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('logs out successfully', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/mật khẩu/i).fill('Admin@123456')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await page.waitForURL(/\/board|\/dashboard/, { timeout: 10000 })
    await page.getByRole('button', { name: /admin|alice|profile/i }).click()
    await page.getByText(/đăng xuất|logout/i).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

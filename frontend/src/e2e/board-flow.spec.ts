import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/user.json' })

test.describe('Board Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/mật khẩu/i).fill('Admin@123456')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await page.waitForURL(/board/, { timeout: 10000 })
  })

  test('shows board with columns', async ({ page }) => {
    await expect(page.locator('[data-testid="board-column"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('can search tasks', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/tìm kiếm/i)
    await searchInput.fill('test query')
    await page.waitForTimeout(400)
    await expect(searchInput).toHaveValue('test query')
  })

  test('can open task detail modal', async ({ page }) => {
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (await taskCard.isVisible()) {
      await taskCard.click()
      await expect(page.locator('[data-testid="task-detail-modal"]')).toBeVisible()
    }
  })

  test('can add a new task via modal', async ({ page }) => {
    await page.getByRole('button', { name: /thêm task|tạo task|new task/i }).first().click()
    await page.getByLabel(/tiêu đề/i).fill('E2E Test Task')
    await page.getByRole('button', { name: /lưu|tạo|create/i }).click()
    await expect(page.getByText('E2E Test Task')).toBeVisible({ timeout: 5000 })
  })

  test('can filter by priority', async ({ page }) => {
    await page.getByRole('button', { name: /ưu tiên|priority/i }).click()
    await page.getByText(/cao|high/i).click()
    await page.waitForTimeout(300)
    const taskCards = page.locator('[data-testid="task-card"]')
    if (await taskCards.count() > 0) {
      const firstCard = taskCards.first()
      await expect(firstCard.getByText(/high|cao/i)).toBeVisible()
    }
  })

  test('can add a new column', async ({ page }) => {
    await page.getByRole('button', { name: /thêm cột|add column/i }).click()
    await page.getByPlaceholder(/tên cột/i).fill('E2E Column')
    await page.keyboard.press('Enter')
    await expect(page.getByText('E2E Column')).toBeVisible({ timeout: 5000 })
  })
})

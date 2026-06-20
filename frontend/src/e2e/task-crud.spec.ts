import { test, expect } from '@playwright/test'

test.describe('Task CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByLabel(/mật khẩu/i).fill('Admin@123456')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await page.waitForURL(/board/, { timeout: 10000 })
  })

  test('can create a task with all fields', async ({ page }) => {
    await page.getByRole('button', { name: /thêm task|tạo task/i }).first().click()
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    await modal.getByLabel(/tiêu đề/i).fill('Full Fields Task')
    await modal.getByLabel(/mô tả/i).fill('Detailed description')

    const prioritySelect = modal.getByLabel(/ưu tiên|priority/i)
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high')
    }

    await page.getByRole('button', { name: /lưu|tạo/i }).click()
    await expect(page.getByText('Full Fields Task')).toBeVisible({ timeout: 5000 })
  })

  test('can edit a task title inline', async ({ page }) => {
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (!(await taskCard.isVisible())) {
      test.skip()
      return
    }
    await taskCard.click()
    const modal = page.locator('[data-testid="task-detail-modal"]')
    await expect(modal).toBeVisible()

    const titleInput = modal.locator('input[name="title"], textarea[name="title"]').first()
    await titleInput.clear()
    await titleInput.fill('Edited Task Title')
    await titleInput.press('Enter')
    await expect(page.getByText('Edited Task Title')).toBeVisible({ timeout: 5000 })
  })

  test('can change task status from detail modal', async ({ page }) => {
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (!(await taskCard.isVisible())) {
      test.skip()
      return
    }
    await taskCard.click()
    const modal = page.locator('[data-testid="task-detail-modal"]')

    const statusSelect = modal.getByLabel(/trạng thái|status/i)
    await statusSelect.selectOption('in_progress')
    await page.waitForTimeout(300)
    await expect(statusSelect).toHaveValue('in_progress')
  })

  test('can add a comment to a task', async ({ page }) => {
    const taskCard = page.locator('[data-testid="task-card"]').first()
    if (!(await taskCard.isVisible())) {
      test.skip()
      return
    }
    await taskCard.click()

    const commentInput = page.getByPlaceholder(/viết bình luận/i)
    await commentInput.fill('E2E test comment')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByText('E2E test comment')).toBeVisible({ timeout: 5000 })
  })

  test('can delete a task', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="task-card"]').count()
    if (initialCount === 0) {
      test.skip()
      return
    }

    const taskCard = page.locator('[data-testid="task-card"]').first()
    const taskTitle = await taskCard.locator('[data-testid="task-title"]').textContent()
    await taskCard.click()

    await page.getByRole('button', { name: /xóa|delete/i }).click()
    await page.getByRole('button', { name: /xác nhận|confirm/i }).click()

    if (taskTitle) {
      await expect(page.getByText(taskTitle)).not.toBeVisible({ timeout: 5000 })
    }
  })
})

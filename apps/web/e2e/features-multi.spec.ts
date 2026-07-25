import { expect, test, type Page } from '@playwright/test'

async function loginAs(page: Page, user: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForSelector('#username', { timeout: 20_000 })
  await page.fill('#username', user)
  await page.fill('#password', user)
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20_000 })
}

test('admin can edit an existing block (form prefilled with choice-box types)', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Blocks' }).click()
  await expect(page.getByRole('heading', { name: 'Function Blocks' })).toBeVisible()
  // Type is a choice box now.
  await expect(page.getByLabel('Inputs 0 type')).toHaveRole('combobox')
  // Edit an existing block -> form prefills.
  await page.getByRole('button', { name: /edit api-call/i }).click()
  await expect(page.getByLabel('block name')).toHaveValue('api-call')
  await expect(page.getByLabel('entrypoint')).toHaveValue('run')
})

test('admin dashboard has Projects and Groups panels', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }).click()
  await page.getByText('Projects', { exact: true }).first().click()
  await expect(page.getByText(/Payments Platform|New project|project/i).first()).toBeVisible()
  await page.getByText('Groups', { exact: true }).first().click()
  await expect(page.getByText(/team-alpha|import|group/i).first()).toBeVisible()
})

test('resource detail offers Edit + Delete (approval) and Resources has Import entity', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()
  // Import entity entry point.
  await expect(page.getByRole('link', { name: /Import entity/i })).toBeVisible()
  // Open a resource -> Edit + Delete present.
  await page.locator('table tbody tr td a').first().click()
  await expect(page.getByRole('link', { name: /Edit/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Delete/ })).toBeVisible()

  // Import screen loads with a type picker.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click()
  await page.getByRole('link', { name: /Import entity/i }).click()
  await expect(page.getByRole('heading', { name: 'Import entity' })).toBeVisible()
})

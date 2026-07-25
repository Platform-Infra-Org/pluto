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

test('resource renders as a form with a raw toggle and a dependency graph', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click()
  await page.getByRole('link', { name: 'orders-db' }).click()

  // Form view (default) — fields rendered, not a raw JSON blob.
  await expect(page.getByText('kind', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('metadata', { exact: true }).first()).toBeVisible()
  // Toggle to Raw JSON shows the JSON braces.
  await page.getByRole('button', { name: 'Raw JSON' }).click()
  await expect(page.locator('pre').first()).toContainText('"payload"')
  // Toggle back to Form.
  await page.getByRole('button', { name: 'Form', exact: true }).click()

  // Dependency graph: this resource depends on prod-net (linked by the id field).
  await expect(page.getByText('Dependency graph')).toBeVisible()
  await expect(page.locator('.react-flow__node', { hasText: 'prod-net' })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.react-flow__node', { hasText: 'orders-db' })).toBeVisible()
})

test('service builder has an id-field choice box', async ({ page }) => {
  await loginAs(page, 'requester') // has service-owner
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Graph Editor' }).click()
  const idField = page.getByLabel('id field')
  await expect(idField).toBeVisible()
  await expect(idField).toHaveRole('combobox')
  await expect(idField.locator('option', { hasText: 'metadata.name' })).toHaveCount(1)
})

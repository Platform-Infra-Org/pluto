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

test('new-block form creates a block (no raw YAML)', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Blocks' }).click()
  await expect(page.getByRole('heading', { name: 'Function Blocks' })).toBeVisible()
  // It's a form now, not a manifest textarea.
  await expect(page.getByLabel('block name')).toBeVisible()
  const name = `e2e-block-${Date.now() % 100000}`
  await page.getByLabel('block name').fill(name)
  await page.getByLabel('template ref').fill('fn-e2e')
  await page.getByLabel('Inputs 0 name').fill('channel')
  await page.getByLabel('Inputs 0 type').fill('string')
  await page.getByRole('button', { name: 'Create block' }).click()
  // The new block shows up in the registry list.
  await expect(page.getByText(name, { exact: false })).toBeVisible({ timeout: 10_000 })
})

test('logout returns to the home page', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('button', { name: 'Logout' }).click()
  // After the Keycloak logout it lands back on the app home (logged out).
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Platform' })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
})

test('an approved onboarded type is available to request', async ({ page }) => {
  // app-db was onboarded + approved via the API check; it must appear in the picker.
  await loginAs(page, 'requester')
  await page.getByRole('link', { name: /New request/ }).first().click()
  await expect(page.getByRole('heading', { name: 'New request' })).toBeVisible()
  await expect(page.getByRole('link', { name: /app-db/ })).toBeVisible({ timeout: 10_000 })
})

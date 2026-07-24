import { expect, test, type Page } from '@playwright/test'

// Regression: clicking a resource used to do a full-page <a href> nav, which
// reloaded the SPA and wiped the in-memory token → detail fetch 401 → "not
// found". Links are now client-side <Link>, so a real click must load detail.
async function loginAs(page: Page, user: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForSelector('#username', { timeout: 20_000 })
  await page.fill('#username', user)
  await page.fill('#password', user)
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20_000 })
}

test('clicking a resource opens its detail (token survives nav)', async ({ page }) => {
  await loginAs(page, 'requester')

  // Go to Resources via the in-app nav link (real click).
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()

  // Click the first resource name (a real client-side <Link> click).
  const firstResource = page.locator('table tbody tr td a').first()
  const name = (await firstResource.textContent())?.trim() ?? ''
  expect(name.length).toBeGreaterThan(0)
  await firstResource.click()

  // Detail must render — NOT the "Resource not found" error.
  await expect(page.getByText('Resource not found.')).toHaveCount(0)
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Raw JSON' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/resource-click-fixed.png', fullPage: true })
})

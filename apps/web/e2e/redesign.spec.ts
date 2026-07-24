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

test('redesign: themes + admin dashboard + resource click', async ({ page }) => {
  await loginAs(page, 'admin')

  // Admin dashboard — light + default (indigo).
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'e2e/screenshots/redesign-01-admin-light-indigo.png', fullPage: true })

  // Toggle dark mode via the real switcher.
  await page.getByRole('button', { name: /Switch to dark mode/i }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: 'e2e/screenshots/redesign-02-admin-dark-indigo.png', fullPage: true })

  // Switch accent to emerald.
  await page.getByRole('button', { name: /Choose accent color/i }).click()
  await page.getByRole('menuitemradio', { name: 'emerald' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald')
  await page.screenshot({ path: 'e2e/screenshots/redesign-03-admin-dark-emerald.png', fullPage: true })

  // Resources list styled (still dark+emerald).
  await page.getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/redesign-04-resources-dark-emerald.png', fullPage: true })
})

test('redesign: requester resource click still works + light rose', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()

  // Pick a light rose theme for variety.
  await page.getByRole('button', { name: /Choose accent color/i }).click()
  await page.getByRole('menuitemradio', { name: 'rose' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'e2e/screenshots/redesign-05-resources-light-rose.png', fullPage: true })

  // Real click into detail — must load, not "not found".
  const first = page.locator('table tbody tr td a').first()
  const name = (await first.textContent())?.trim() ?? ''
  await first.click()
  await expect(page.getByText('Resource not found.')).toHaveCount(0)
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'e2e/screenshots/redesign-06-resource-detail-light-rose.png', fullPage: true })
})

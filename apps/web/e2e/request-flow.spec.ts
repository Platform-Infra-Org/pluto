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

test('home cards are clickable', async ({ page }) => {
  await loginAs(page, 'requester')
  // Click the "Resources" feature card on the home page.
  await page.getByRole('link', { name: /Resources/ }).first().click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/flow-01-home-card-nav.png', fullPage: true })
})

test('trigger a change request from a resource detail', async ({ page }) => {
  await loginAs(page, 'requester')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()

  // Open the first resource, then request an update.
  await page.locator('table tbody tr td a').first().click()
  await page.screenshot({ path: 'e2e/screenshots/flow-02-detail-with-actions.png', fullPage: true })
  await page.getByRole('link', { name: /Request update/ }).click()

  // The request form loads (UPDATE <type>) and submits.
  await expect(page.getByRole('heading', { name: /UPDATE/ })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Submit request' }).click()

  // Success confirmation.
  await expect(page.getByText(/Request #\d+ submitted/)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'e2e/screenshots/flow-03-request-submitted.png', fullPage: true })

  // It shows up under My Requests.
  await nav.getByRole('link', { name: 'My Requests' }).click()
  await expect(page.getByRole('heading', { name: 'My Requests' })).toBeVisible()
  await expect(page.locator('a', { hasText: /UPDATE/ }).first()).toBeVisible()
})

test('New request CTA opens the type picker', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('link', { name: /New request/ }).first().click()
  await expect(page.getByRole('heading', { name: 'New request' })).toBeVisible()
  // Type options derived from the catalog (database, bucket).
  await expect(page.getByRole('link', { name: /database/ })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/flow-04-type-picker.png', fullPage: true })
})

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

// Regression for "NetworkError when attempting to fetch resource": an unhandled BFF
// 500 used to bypass CORS and surface as a browser NetworkError. After login, no /api
// request may fail at the network level, and the resource fetch must render rows.
test('no NetworkError fetching resources or using the graph editor', async ({ page }) => {
  const netFails: string[] = []
  page.on('requestfailed', (r) => {
    // Ignore aborted long-poll/SSE streams on teardown; flag real /api failures.
    const err = r.failure()?.errorText ?? ''
    if (r.url().includes('/api/') && !r.url().includes('/stream') && !/aborted/i.test(err))
      netFails.push(`${r.url()} ${err}`)
  })
  page.on('console', (m) => {
    if (/NetworkError|CORS|ERR_FAILED/i.test(m.text())) netFails.push(`console: ${m.text()}`)
  })

  await loginAs(page, 'requester')
  const nav = page.getByRole('navigation', { name: 'Main' })

  // Fetch resources — must render rows (proves the fetch resolved, not a NetworkError).
  await nav.getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()
  await expect(page.locator('table tbody tr td a').first()).toBeVisible({ timeout: 15_000 })

  // Graph editor: adding a node fires a live generate round-trip that must return an
  // HTTP result (the preview), never a NetworkError.
  await nav.getByRole('link', { name: 'Graph Editor' }).click()
  await page.getByRole('button', { name: /^api-call/ }).first().click()
  await expect(page.getByText('Generated preview')).toBeVisible()
  await page.waitForTimeout(1200)

  expect(netFails, `network-level failures: ${netFails.join(' | ')}`).toEqual([])
})

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

test('graph editor UI fixes: aligned handles, enum choice box, request-fields sub-tab', async ({ page }) => {
  await loginAs(page, 'requester')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Graph Editor' }).click()
  await expect(page.getByRole('button', { name: /api-call/ })).toBeVisible({ timeout: 15_000 })

  // Add an api-call node and select it.
  await page.getByRole('button', { name: /^api-call/ }).first().click()
  // The node now shows its input/output labels (method, url, body, headers / status, response).
  const node = page.locator('.react-flow__node').first()
  await expect(node).toBeVisible()
  await expect(node.getByText('method', { exact: true })).toBeVisible()
  await expect(node.getByText('response', { exact: true })).toBeVisible()
  await node.click()

  // Fix 2: the enum `method` config is a choice box (select) with the enum options.
  const method = page.getByLabel('config method')
  await expect(method).toBeVisible()
  await expect(method.locator('option', { hasText: 'POST' })).toHaveCount(1)
  await expect(method.locator('option', { hasText: 'DELETE' })).toHaveCount(1)
  await method.selectOption('POST')
  await expect(method).toHaveValue('POST')
  await page.screenshot({ path: 'e2e/screenshots/cb-ui-01-node-and-enum.png', fullPage: true })

  // Fix 3: request fields live in their own sub-tab, not inline.
  await expect(page.getByLabel('request field name')).toHaveCount(0) // hidden on the Graph tab
  await page.getByRole('tab', { name: 'Request fields' }).click()
  await expect(page.getByLabel('request field name')).toBeVisible()
  await page.getByLabel('request field name').fill('app_name')
  await page.getByRole('button', { name: 'add field' }).click()
  await expect(page.getByText('app_name', { exact: false })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/cb-ui-02-request-fields-subtab.png', fullPage: true })
})

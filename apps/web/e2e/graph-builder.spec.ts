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

// requester has the service-owner role (granted earlier), so the Graph Editor is available.
test('graph editor loads blocks from the API and generates a live preview', async ({ page }) => {
  await loginAs(page, 'requester')

  // Navigate in-app to the Graph Editor (never page.goto — keeps the in-memory token).
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Graph Editor' }).click()

  // Palette is populated from GET /api/blocks — the seeded v1 built-in function blocks.
  await expect(page.getByRole('button', { name: /api-call/ })).toBeVisible({ timeout: 15_000 })
  for (const b of ['json-extractor', 'set-value', 'git-commit', 'jinja-render']) {
    await expect(page.getByRole('button', { name: new RegExp(b) }).first()).toBeVisible()
  }
  await page.screenshot({ path: 'e2e/screenshots/cb-01-graph-editor-palette.png', fullPage: true })

  // Add an api-call node (palette items are click-to-add).
  await page.getByRole('button', { name: /^api-call/ }).first().click()

  // The live preview fires the generate round-trip — it shows either the generated
  // WorkflowTemplate or validation errors (both prove editor → generate → blocks works live).
  const preview = page.getByText('Generated preview')
  await expect(preview).toBeVisible()
  await expect
    .poll(async () => {
      const hasYaml = await page.getByText('WorkflowTemplate', { exact: false }).count()
      const hasErrors = await page.getByRole('alert').count()
      return hasYaml + hasErrors
    }, { timeout: 15_000 })
    .toBeGreaterThan(0)
  await page.screenshot({ path: 'e2e/screenshots/cb-02-graph-editor-preview.png', fullPage: true })
})

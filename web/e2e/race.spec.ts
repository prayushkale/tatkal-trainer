import { expect, test } from '@playwright/test'

test('full race flow, blame highlight, slider re-run, and zero console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err))
  })

  await page.goto('/?seed=42&start=1')

  const bookBtn = page.getByTestId('book-btn')
  const clock = page.getByTestId('led-clock')

  await expect(bookBtn).toHaveAttribute('aria-disabled', 'true')
  await expect(clock).toHaveText('09:59:59')

  await expect(clock).toHaveText('10:00:00', { timeout: 3000 })
  await expect(bookBtn).toHaveAttribute('aria-disabled', 'false')

  await bookBtn.click()

  const stamp = page.getByTestId('result-stamp')
  await expect(stamp).toBeVisible({ timeout: 1500 })
  const stampText = (await stamp.textContent())?.trim() ?? ''
  expect(stampText).toMatch(/^(CNF B\d+\/\d+|WL \d+|REGRET|FAILED: .+)$/)

  const pipelineSvg = page.getByTestId('pipeline-svg')
  await expect(pipelineSvg).toBeVisible()

  const expectedBlamed = stampText.startsWith('CNF ') ? 0 : 1
  await expect(pipelineSvg.locator('.pipeline-node.is-blamed')).toHaveCount(expectedBlamed)

  // Move rate-limit slider and expect "With these settings" line
  const rateSlider = page.getByTestId('rate-slider')
  await rateSlider.fill('200')
  await rateSlider.dispatchEvent('input')

  const delta = page.getByTestId('slider-delta')
  await expect(delta).toBeVisible({ timeout: 1500 })
  await expect(delta).toContainText("With these settings you'd have got:")

  // Open stage drawer via keyboard Enter on Seat lock node
  const lockNode = pipelineSvg.locator('[data-stage="lock"]')
  await lockNode.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByTestId('stage-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('FOR UPDATE SKIP LOCKED')

  expect(consoleErrors).toEqual([])
})

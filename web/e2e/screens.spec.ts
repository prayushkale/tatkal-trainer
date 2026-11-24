import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENS_DIR = path.resolve(__dirname, '../screens')
const OG_PATH = path.resolve(__dirname, '../public/og.png')

const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
] as const

for (const vp of VIEWPORTS) {
  test(`capture all 6 UI states at ${vp.width}x${vp.height}`, async ({ page }) => {
    mkdirSync(SCREENS_DIR, { recursive: true })
    await page.setViewportSize({ width: vp.width, height: vp.height })

    await page.goto('/?seed=5&start=2')
    const bookBtn = page.getByTestId('book-btn')

    // 1. Countdown state
    await expect(bookBtn).toHaveAttribute('aria-disabled', 'true')
    const overflow1 = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow1).toBe(false)
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-1-countdown.png`) })

    // 2. Open state (10:00:00 + ~280ms so we land in the prime Tatkal rush window)
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="led-offset"]')
      if (!el) return false
      const m = el.textContent?.match(/\+([0-9.]+)/)
      return m !== null && Number(m[1]) >= 0.25
    })
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-2-open.png`) })

    // 3. Waiting bar state
    await bookBtn.click()
    await expect(page.getByTestId('waiting-bar')).toBeVisible({ timeout: 500 })
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-3-waiting.png`) })

    // 4. Result state (capture mid-particle-replay)
    await expect(page.getByTestId('result-stamp')).toBeVisible({ timeout: 1500 })
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 900)))
    const overflow4 = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow4).toBe(false)
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-4-result.png`) })

    // 5. Stage drawer open (Seat lock)
    await page.getByTestId('pipeline-svg').locator('[data-stage="lock"]').click()
    await expect(page.getByTestId('stage-drawer')).toBeVisible()
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-5-drawer.png`) })
    await page.getByTestId('drawer-close').click()

    // 6. Sliders adjusted
    const rateSlider = page.getByTestId('rate-slider')
    await rateSlider.fill('150')
    await rateSlider.dispatchEvent('input')
    await expect(page.getByTestId('slider-delta')).toBeVisible({ timeout: 1500 })
    await page.screenshot({ path: path.join(SCREENS_DIR, `${vp.name}-6-sliders.png`) })
  })
}

test('capture 1200x630 Open Graph image', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto('/?seed=5&start=1')
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="led-offset"]')
    if (!el) return false
    const m = el.textContent?.match(/\+([0-9.]+)/)
    return m !== null && Number(m[1]) >= 0.25
  })
  await page.getByTestId('book-btn').click()
  await expect(page.getByTestId('result-stamp')).toBeVisible({ timeout: 1500 })
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 900)))
  await page.screenshot({ path: OG_PATH })
})

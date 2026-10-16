import { spawnSync } from 'node:child_process'

// The full catalog, campus POS and parent suite runs independently at both sizes.
for (const width of [390, 1280]) {
  const result = spawnSync(process.execPath, ['tests/shop-catalog.browser.mjs'], {
    stdio: 'inherit', env: { ...process.env, CATALOG_VIEWPORT_WIDTH: String(width) },
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

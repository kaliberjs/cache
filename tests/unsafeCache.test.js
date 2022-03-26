import { it, expect } from '@jest/globals'
import { createCache } from '../index'

const cacheKey = 'cacheKey'

it('returns a expired cache item', async () => {
  const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })

  expect(await cache(() => timeout(25, { label: 1 }), { cacheKey })).toEqual({ label: 1 })
  await timeout(100)
  expect(await cache(() => timeout(25, { label: 2 }), { cacheKey })).toEqual({ label: 1 })
  await timeout(1000)
  expect(await cache(() => timeout(25, { label: 3 }), { cacheKey })).toEqual({ label: 2 })
})

async function timeout(milliseconds, label) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

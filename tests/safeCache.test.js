import { it, expect, jest } from '@jest/globals'
import { createCache } from '../index'

const cacheKey = ['cache', 10]

it(`doesn't call the callback function when there is a valid cache item`, async () => {
  const callback = jest.fn(() => timeout(250, { label: 1 }))
  const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 500 })

  await Promise.all([
    cache(callback, { cacheKey }),
    cache(callback, { cacheKey }),
    cache(callback, { cacheKey }),
  ])

  expect(callback).toBeCalledTimes(1)
})

it('returns a cached item when the expirationTime is not reached', async () => {
  const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

  await Promise.all([
    cache(() => timeout(250, { label: 1 }), { cacheKey }),
    cache(() => timeout(250, { label: 2 }), { cacheKey }),
  ])

  expect(await cache(() => timeout(250, { label: 3 }), { cacheKey })).toEqual({ label: 1 })
})

it('returns the current value if there is no valid cache item', async () => {
  const expirationTime = 500
  const cache = createCache({ allowReturnExpiredValue: false, expirationTime })

  expect(await cache(() => timeout(250, { label: 1 }), { cacheKey })).toEqual({ label: 1 })

  await timeout(expirationTime)

  expect(await cache(() => timeout(250, { label: 2 }), { cacheKey })).toEqual({ label: 2 })
})

async function timeout(milliseconds, label) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

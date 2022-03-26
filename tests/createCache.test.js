import { it, expect, jest } from '@jest/globals'
import { createCache } from '../index'

it('allows for multiple cacheKeys to be used', () => {
  const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

  expect(cache).toBeInstanceOf(Function)
  expect(cache(() => 1, { cacheKey: ['labels', 1] })).toBe(1)
  expect(cache(() => 2, { cacheKey: ['labels', 2] })).toBe(2)
  expect(cache(() => 3, { cacheKey: 'stringKey' })).toBe(3)
})

it('accepts a function and returns the value that is return from the given function', async () => {
  const callback = jest.fn(() => true)
  const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

  const callbackResult = cache(callback, { cacheKey: 'callback' })

  expect(callback).toBeCalledTimes(1)
  expect(callbackResult).toEqual(true)

  const promise = jest.fn(() => Promise.resolve(true))
  const promiseResult = cache(promise, { cacheKey: 'promise' })

  expect(promise).toBeCalledTimes(1)
  expect(promiseResult).toBeInstanceOf(Promise)
  expect(await promiseResult).toBe(true)
})

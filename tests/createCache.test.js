import { it, expect, describe, jest, beforeEach } from '@jest/globals'
import { createCache } from '../index'

describe('createCache', () => {
  let cache = null
  const cacheKey = 'cacheKey'
  const expectedOutput = { expectedOutput: 'expectedOutput' }

  let callback = null
  let rejectedCallback = null
  let promiseCallback = null

  beforeEach(() => {
    cache = createCache({ allowReturnExpiredValue: false, expirationTime: 50 })
    callback = jest.fn(() => expectedOutput)
    rejectedCallback = jest.fn(() => { return new Promise((_, reject) => reject('this promise is rejected')) })
    promiseCallback = jest.fn(() => new Promise((resolve) => resolve(expectedOutput)))
  })

  it('returns a function when called', () => {
    expect(cache).toBeInstanceOf(Function) //  AsyncFunction
  })

  it('allows the returned function to be called with a callback function and a cacheKey', () => {
    cache(callback, { cacheKey })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('returns the callback results when a item is added to the cache', async () => {
    const result = await cache(callback, { cacheKey })

    expect(result).toEqual(expectedOutput)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('handles a promise as callback result', async () => {
    const promiseResult = await cache(promiseCallback, { cacheKey: 'promise' })

    expect(promiseResult).toEqual(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('only caches a promise result if the promise is resolved', async () => {
    const result1 = await cache(rejectedCallback, { cacheKey })
    expect(result1).toBeInstanceOf(Error)
    expect(rejectedCallback).toHaveBeenCalledTimes(1)

    const result2 = await cache(promiseCallback, { cacheKey })
    expect(result2).toBe(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('returns a cached value if a promises fails and there was a valid item in cache, ignores the validation time', async () => {
    const rejectedCallback = jest.fn(() => { return new Promise((_, reject) => reject('this promise is rejected')) })
    const promiseCallback = jest.fn(() => new Promise((resolve) => resolve(expectedOutput)))

    await cache(promiseCallback, { cacheKey })
    await timeout(75)

    const result = await cache(rejectedCallback, { cacheKey })
    expect(result).toBe(expectedOutput)
    expect(rejectedCallback).toHaveBeenCalledTimes(1)
  })
})

describe('createCache in safeMode', () => {
  let cache = null
  const cacheKey = 'cacheKey'

  beforeEach(() => {
    cache = createCache({ allowReturnExpiredValue: false, expirationTime: 50 })
  })

  it('does not call the callback when a valid value is in cache', async () => {
    const callback1 = jest.fn(() => ({ data: 'callback1' }))
    const callback2 = jest.fn(() => ({ data: 'callback2' }))

    await cache(callback1, { cacheKey })
    await cache(callback2, { cacheKey })
    await cache(callback2, { cacheKey })

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
  })

  it('returns a cached value when the expiration time is not reached', async () => {
    const callback1 = () => ({ data: 'callback1' })
    const callback2 = () => ({ data: 'callback2' })

    await cache(callback1, { cacheKey })
    await cache(callback2, { cacheKey })
    const result = await cache(callback2, { cacheKey })
    expect(result).toEqual({ data: 'callback1' })
  })

  it('returns the results of a given callback function when expiration time is reached', async () => {
    const callback1 = jest.fn(() => ({ data: 'callback1' }))
    const callback2 = jest.fn(() => ({ data: 'callback2' }))

    await cache(callback1, { cacheKey })
    await timeout(75)
    const result = await cache(callback2, { cacheKey })

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: 'callback2' })
  })
})

describe('createCache in unsafeMode', () => {
  let cache = null
  const cacheKey = 'cacheKey'

  beforeEach(() => {
    cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
  })

  it('does not call the callback when a valid value is in cache', async () => {
    const callback1 = jest.fn(() => ({ data: 'callback1' }))
    const callback2 = jest.fn(() => ({ data: 'callback2' }))

    await cache(callback1, { cacheKey })
    await cache(callback2, { cacheKey })
    await cache(callback2, { cacheKey })

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
  })

  it('returns a expired value when called after the cache expiry time but calls the callback function', async () => {
    const callback1 = jest.fn(() => ({ data: 'callback1' }))
    const callback2 = jest.fn(() => ({ data: 'callback2' }))

    cache(callback1, { cacheKey })
    await timeout(75)
    const result = await cache(callback2, { cacheKey })

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: 'callback1' })
  })
})

async function timeout(milliseconds, label) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

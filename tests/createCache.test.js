import { it, expect, describe, jest, beforeEach } from '@jest/globals'
import { createCache } from '../index'

describe('createCache with expiredValues disabled', () => {
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

  it('allows for a empty callback function', () => {
    cache(() => { }, { cacheKey })
  })

  it('returns the callback results when a item is added to the cache', async () => {
    const result = cache(callback, { cacheKey })

    expect(result).toEqual(expectedOutput)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('handles a promise as callback result', async () => {
    const promiseResult = await cache(promiseCallback, { cacheKey: 'promise' })

    expect(promiseResult).toEqual(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('only caches a promise result if the promise is resolved', async () => {
    try {
      await cache(rejectedCallback, { cacheKey })
    } catch (e) {
      // ignore error
    }

    expect(rejectedCallback).toHaveBeenCalledTimes(1)

    const result2 = await cache(promiseCallback, { cacheKey })
    expect(result2).toBe(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('removes promise from cache when rejected', async () => {
    const result1 = cache(rejectedCallback, { cacheKey })
    const result2 = cache(promiseCallback, { cacheKey })
    expect(result1).toEqual(result2)

    try { await result2 } catch (e) { }
    const result3 = await cache(promiseCallback, { cacheKey })
    expect(result3).toEqual(expectedOutput)
  })
})

describe('createCache with expiredValues enabled', () => {
  let cache = null
  const cacheKey = 'cacheKey'
  const expectedOutput = { expectedOutput: 'expectedOutput' }

  let rejectedCallback = null
  let promiseCallback = null
  let dontCallCallback = null

  beforeEach(() => {
    cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    rejectedCallback = jest.fn(() => { return new Promise((_, reject) => reject('this promise is rejected')) })
    promiseCallback = jest.fn(() => new Promise((resolve) => resolve(expectedOutput)))
    dontCallCallback = jest.fn()
  })

  it('returns a previous value even if the expired time is reached', async () => {
    const callback1 = jest.fn(() => ({ data: 'callback1' }))
    const callback2 = jest.fn(() => ({ data: 'callback2' }))

    await cache(callback1, { cacheKey })
    await timeout(75)
    const result1 = await cache(callback2, { cacheKey })
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(result1).toEqual({ data: 'callback1' })

    await timeout(75)
    const result2 = await cache(() => { }, { cacheKey })
    expect(result2).toEqual({ data: 'callback2' })
  })

  it('returns previous value when the promise rejects', async () => {
    cache(promiseCallback, { cacheKey })
    await timeout(75)
    const result1 = cache(rejectedCallback, { cacheKey })
    const result2 = cache(dontCallCallback, { cacheKey })
    expect(dontCallCallback).toHaveBeenCalledTimes(0)
    expect(await result1).toEqual(expectedOutput)
    await expect(result2).rejects.toEqual("this promise is rejected")
    const result3 = await cache(rejectedCallback, { cacheKey })
    expect(result3).toEqual(expectedOutput)
  })
})

async function timeout(milliseconds, label) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

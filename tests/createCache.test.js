import assert from 'node:assert'
import { createCache } from '../index.js'
import { beforeEach, describe, it } from 'node:test'
/** @import { SuiteContext, TestContext, Mock } from 'node:test' */

describe('createCache - allowReturnExpiredValue: disabled', () => {
  /** @type {ReturnType<typeof createCache>} */
  let cache
  const cacheKey = 'cacheKey'
  const expectedOutput = { expectedOutput: 'expectedOutput' }

  /** @type {Mock<() => any>} */
  let callback
  /** @type {Mock<() => any>} */
  let rejectedCallback
  /** @type {Mock<() => any>} */
  let promiseCallback

  beforeEach(t => {
    if (!isTestContext(t))
      throw new Error('Expected test context')

    cache = createCache({ allowReturnExpiredValue: false, expirationTime: 50 })
    callback = t.mock.fn(() => expectedOutput)
    rejectedCallback = t.mock.fn(() => { return new Promise((_, reject) => reject('this promise is rejected')) })
    promiseCallback = t.mock.fn(() => new Promise((resolve) => resolve(expectedOutput)))
  })

  it('returns a function when called', () => {
    expect(cache).toBeInstanceOf(Function) //  AsyncFunction
  })

  it('allows the returned function to be called with a callback function and a cacheKey', () => {
    cache({ cacheKey, getValue: callback })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('allows different values to be returned', () => {
    expect(cache({ cacheKey: 'empty', getValue: () => { } })).toBe(undefined)
    expect(cache({ cacheKey: 'false', getValue: () => { return false } })).toBe(false)
    expect(cache({ cacheKey: 'true', getValue: () => { return true } })).toBe(true)
    expect(cache({ cacheKey: 'null', getValue: () => { return null } })).toBe(null)
    expect(cache({ cacheKey: 'object', getValue: () => { return {} } })).toEqual({})
    expect(cache({ cacheKey: 'undefined', getValue: () => { return undefined } })).toEqual(undefined)
  })

  it('returns the callback results when a item is added to the cache', async () => {
    const result = cache({ cacheKey, getValue: callback })

    expect(result).toEqual(expectedOutput)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('handles a promise as callback result', async () => {
    const promiseResult = await cache({ cacheKey: 'promise', getValue: promiseCallback })

    expect(promiseResult).toEqual(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('only caches a promise result if the promise is resolved', async () => {
    try {
      await cache({ cacheKey, getValue: rejectedCallback })
    } catch (e) {
      // ignore error
    }
    expect(rejectedCallback).toHaveBeenCalledTimes(1)

    const result2 = await cache({ cacheKey, getValue: promiseCallback })
    expect(result2).toBe(expectedOutput)
    expect(promiseCallback).toHaveBeenCalledTimes(1)
  })

  it('removes promise from cache when rejected', async () => {
    const result1 = cache({ cacheKey, getValue: rejectedCallback })
    const result2 = cache({ cacheKey, getValue: promiseCallback })
    expect(result1).toEqual(result2)

    try { await result2 } catch (e) { }
    const result3 = await cache({ cacheKey, getValue: promiseCallback })
    expect(result3).toEqual(expectedOutput)
  })
})

describe('createCache - allowReturnExpiredValue: enabled', () => {
  /** @type {ReturnType<typeof createCache>} */
  let cache
  const cacheKey = 'cacheKey'
  const expectedOutput = { expectedOutput: 'expectedOutput' }

  /** @type {Mock<() => any>} */
  let rejectedCallback
  /** @type {Mock<() => any>} */
  let promiseCallback
  /** @type {Mock<() => any>} */
  let dontCallCallback

  beforeEach(t => {
    if (!isTestContext(t))
      throw new Error('Expected test context')

    cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    rejectedCallback = t.mock.fn(() => { return new Promise((_, reject) => reject(new Error('this promise is rejected'))) })
    promiseCallback = t.mock.fn(() => new Promise((resolve) => resolve(expectedOutput)))
    dontCallCallback = t.mock.fn()
  })

  it('returns a previous value even if the expired time is reached', async t => {
    const callback1 = t.mock.fn(() => ({ data: 'callback1' }))
    const callback2 = t.mock.fn(() => ({ data: 'callback2' }))

    await cache({ cacheKey, getValue: callback1 })
    await timeout(75)
    const result1 = await cache({ cacheKey, getValue: callback2 })
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(result1).toEqual({ data: 'callback1' })

    await timeout(75)
    const result2 = await cache({ cacheKey, getValue: () => { } })
    expect(result2).toEqual({ data: 'callback2' })
  })

  it('returns previous value when the promise rejects', async () => {
    cache({ cacheKey, getValue: promiseCallback })
    await timeout(75)
    const result1 = cache({ cacheKey, getValue: rejectedCallback })
    const result2 = cache({ cacheKey, getValue: dontCallCallback })
    expect(dontCallCallback).toHaveBeenCalledTimes(0)
    expect(await result1).toEqual(expectedOutput)
    expect(await result2).toEqual(expectedOutput)
    const result3 = await cache({ cacheKey, getValue: rejectedCallback })
    expect(result3).toEqual(expectedOutput)
  })
})

describe('createCache - memory management', () => {
  it('releases expired items from memory', async () => {
    if (typeof global.gc !== 'function')
      throw new Error('This test requires the --expose-gc flag to run. (e.g., node --expose-gc test.js)')

    const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 50 })
    const cacheKey = 'releaseMemoryTest'

    // 1. Create an object and wrap it in a WeakRef so we can monitor it without preventing it from being garbage collected.
    /** @type {any} */
    let largeObject = { hugeData: 'iAmHuge' }
    const ref = new WeakRef(largeObject)

    // 2. Put it in the cache
    cache({ cacheKey, getValue: () => largeObject })

    // 3. Destroy our local reference. Now, ONLY the cache is holding onto this object.
    largeObject = null

    // 4. Force GC. The object shouldn't be cleared yet because the cache still holds it.
    global.gc()
    expect(ref.deref() !== undefined).toBe(true)

    // 5. Wait for the cache expiration time to pass
    await timeout(75)

    // 6. Force GC again. If the cache properly deleted its internal reference, the largeObject should now be swept away.
    global.gc()

    // 7. Verify the object has actually been released from memory
    expect(ref.deref()).toBe(undefined)
  })

  it('returns stale data if requested before the hard expiration limit', t => {
    t.mock.timers.enable()
    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 10 })
    const cacheKey = 'staleTest'

    cache({ cacheKey, getValue: () => 'original data' })

    t.mock.timers.tick(50)

    const result = cache({ cacheKey, getValue: () => 'new data' })
    expect(result).toBe('original data')
  })

  it('hard expires and completely purges the item if left untouched past the limit', t => {
    t.mock.timers.enable()
    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 10 })
    const cacheKey = 'purgeTest'

    cache({ cacheKey, getValue: () => 'original data' })

    t.mock.timers.tick(101)

    const result = cache({ cacheKey, getValue: () => 'new data' })
    expect(result).toBe('new data')
  })

  it('does not delete subsequent valid entries when an earlier promise rejects', async t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 50 })
    const cacheKey = 'clearPurgeForFailedPromisesTest'

    // 1. Cache a failing promise
    await cache({ cacheKey, getValue: () => Promise.reject(new Error('Fetch failed')) })
      .catch(() => {}) // ignore error here, we just want to know the promise is resolved

    // 2. Move time forward so the next cache call does not have the same expiration
    t.mock.timers.tick(25)

    // 3. Cache a successful value
    cache({ cacheKey, getValue: () => 'successful data' })

    // 4. Move past 50ms (cache time of the failing promise)
    t.mock.timers.tick(26)

    // 5. Failing promise should not have triggered a purge of the cache
    const result = cache({ cacheKey, getValue: () => 'should not be called' })

    expect(result).toBe('successful data')
  })

  it('clears previous timeouts when refreshing stale data to prevent premature deletion', t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'raceConditionKey'

    cache({ cacheKey, getValue: () => 'data v1' })

    // The items is expired but not removed yet.
    t.mock.timers.tick(100)

    // Even though it has expired, it will return the old value
    const result2 = cache({ cacheKey, getValue: () => 'data v2' })
    expect(result2).toBe('data v1')

    // The item has been removed
    t.mock.timers.tick(401)

    const result4 = cache({ cacheKey, getValue: () => 'data v3' })

    // If the timeout has been handled correctly, we will get the cached data
    expect(result4).toBe('data v2')
  })

  it('prevents memory leaks by re-applying timeouts when a background refresh fails', async t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'leakTestKey'

    await cache({ cacheKey, getValue: () => Promise.resolve('original data') })

    // The item is now stale.
    t.mock.timers.tick(100)

    // We intentionally make this background refresh fail.
    const rejectedPromise = Promise.reject(new Error('Background fetch failed'))
    cache({ cacheKey, getValue: () => rejectedPromise })

    // Wait for the rejection to process and trigger your .catch() block
    try { await rejectedPromise } catch (e) {}

    // If the timeout wasn't restarted in the .catch() block, the item is stuck in memory forever.
    t.mock.timers.tick(500)

    const result3 = await cache({ cacheKey, getValue: () => Promise.resolve('fresh data') })

    expect(result3).toBe('fresh data')
  })

  it('does not restore the stale item if it hard-expired while the background fetch was pending', async t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'expireDuringFetchKey'

    cache({ cacheKey, getValue: () => 'original data' })

    t.mock.timers.tick(100)

    /** @type {(reason?: any) => void} */
    let rejectPromise
    const pendingPromise = new Promise((_, reject) => { rejectPromise = reject })

    const result2 = cache({ cacheKey, getValue: () => pendingPromise })
    expect(result2).toBe('original data')

    t.mock.timers.tick(401)

    // @ts-ignore
    rejectPromise(new Error('Delayed failure'))

    try { await pendingPromise } catch (e) {}

    // The cache should be completely empty because the stale item was correctly discarded.
    const result3 = cache({ cacheKey, getValue: () => 'fresh data' })

    expect(result3).toBe('fresh data')
  })

  it('does not leak memory if getValue throws synchronously during a refresh', t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'syncThrowLeakKey'

    cache({ cacheKey, getValue: () => 'original data' })

    // The item is now stale.
    t.mock.timers.tick(100)

    const expectedError = new Error('Synchronous crash')
    expect(() => cache({ cacheKey, getValue: () => { throw expectedError } }))
      .toThrow(expectedError)

    t.mock.timers.tick(401)

    const result3 = cache({ cacheKey, getValue: () => 'fresh data' })

    expect(result3).toBe('fresh data')
  })

  it('returns stale data instead of a pending promise for concurrent requests during a background refresh', async t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'concurrentRefreshKey'

    cache({ cacheKey, getValue: () => 'original data' })

    // 2. Fast-forward to 100ms. The item is now stale.
    t.mock.timers.tick(100)

    /** @type {(value: any) => void} */
    let resolvePromise
    const pendingPromise = new Promise((resolve) => { resolvePromise = resolve })
    const result2 = cache({ cacheKey, getValue: () => pendingPromise })

    expect(result2).toBe('original data')

    t.mock.timers.tick(10)

    const result3 = cache({ cacheKey, getValue: () => 'should not be called' })

    expect(result3).toBe('original data')

    // Cleanup: resolve the promise so it doesn't hang the test runner
    // @ts-ignore
    resolvePromise('new data')
    await pendingPromise
  })

  it('returns a stale result while a background promise is pending, then returns the fresh result once resolved', async t => {
    t.mock.timers.enable()

    const cache = createCache({ allowReturnExpiredValue: true, expirationTime: 50 })
    const cacheKey = 'staleWhilePendingKey'

    const initialPromise = Promise.resolve('original data')
    await cache({ cacheKey, getValue: () => initialPromise })

    t.mock.timers.tick(100)

    /** @type {(value: any) => void} */
    let resolvePromise
    const pendingPromise = new Promise(resolve => { resolvePromise = resolve })

    const refreshResult = cache({ cacheKey, getValue: () => pendingPromise })
    expect(await refreshResult).toBe('original data')

    t.mock.timers.tick(10)

    const concurrentResult = cache({ cacheKey, getValue: () => 'should not be called' })
    expect(await concurrentResult).toBe('original data')

    // @ts-ignore
    resolvePromise('fresh data')
    await pendingPromise

    const finalResult = cache({ cacheKey, getValue: () => 'should not be called either' })
    expect(await finalResult).toBe('fresh data')
  })
})

describe('createCache - overrideMaxAllowedCacheTime: enabled', () => {
  const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000

  it('throws error when expirationTime exceeds 1 week - allowReturnExpiredValue: false', () => {
    const expectedError = new Error('Expiration time too large, max value for override is 1 week')
    expect(() => {
      createCache({
        allowReturnExpiredValue: false,
        expirationTime: weekInMilliseconds + 1,
        overrideMaxAllowedCacheTime: true
      })
    }).toThrow(expectedError)
  })

  it('throws error when expirationTime exceeds 1 week - allowReturnExpiredValue: true', () => {
    const expectedError = new Error('Expiration time too large, max value for override is 1 week')
    expect(() => {
      createCache({
        allowReturnExpiredValue: true,
        expirationTime: weekInMilliseconds + 1,
        overrideMaxAllowedCacheTime: true
      })
    }).toThrow(expectedError)
  })

  it('creates cache when expirationTime is exactly 1 week - allowReturnExpiredValue: false', () => {
    const cache = createCache({
      allowReturnExpiredValue: false,
      expirationTime: weekInMilliseconds,
      overrideMaxAllowedCacheTime: true
    })
    expect(cache).toBeInstanceOf(Function)
  })

  it('caches for exactly 1 week and evicts properly - allowReturnExpiredValue: false', t => {
    t.mock.timers.enable()
    const cache = createCache({
      allowReturnExpiredValue: false,
      expirationTime: weekInMilliseconds,
      overrideMaxAllowedCacheTime: true
    })
    const cacheKey = 'weekEvictionTest'

    cache({ cacheKey, getValue: () => 'original data' })

    // Fast forward to just before expiration
    t.mock.timers.tick(weekInMilliseconds - 1)
    const result1 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result1).toBe('original data')

    // Fast forward past expiration
    t.mock.timers.tick(2)
    const result2 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result2).toBe('new data')
  })
})

describe('createCache - overrideMaxAllowedCacheTime: disabled', () => {
  const dayInMilliseconds = 24 * 60 * 60 * 1000

  it('throws error when expirationTime exceeds 1 day - allowReturnExpiredValue: false', () => {
    const expectedError = new Error('Expiration time too large, max value for override is 1 day')
    expect(() => {
      createCache({
        allowReturnExpiredValue: false,
        expirationTime: dayInMilliseconds + 1,
        overrideMaxAllowedCacheTime: false
      })
    }).toThrow(expectedError)
  })

  it('throws error when expirationTime exceeds 1 day - allowReturnExpiredValue: true', () => {
    const expectedError = new Error('Expiration time too large, max value for override is 1 day')
    expect(() => {
      createCache({
        allowReturnExpiredValue: true,
        expirationTime: dayInMilliseconds + 1,
        overrideMaxAllowedCacheTime: false
      })
    }).toThrow(expectedError)
  })

  it('creates cache when expirationTime is exactly 1 day - allowReturnExpiredValue: false', () => {
    const cache = createCache({
      allowReturnExpiredValue: false,
      expirationTime: dayInMilliseconds,
      overrideMaxAllowedCacheTime: false
    })
    expect(cache).toBeInstanceOf(Function)
  })

  it('caches for exactly 1 day and evicts properly - allowReturnExpiredValue: false', t => {
    t.mock.timers.enable()
    const cache = createCache({
      allowReturnExpiredValue: false,
      expirationTime: dayInMilliseconds,
      overrideMaxAllowedCacheTime: false
    })
    const cacheKey = 'weekEvictionTest'

    cache({ cacheKey, getValue: () => 'original data' })

    // Fast forward to just before expiration
    t.mock.timers.tick(dayInMilliseconds - 1)
    const result1 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result1).toBe('original data')

    // Fast forward past expiration
    t.mock.timers.tick(2)
    const result2 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result2).toBe('new data')
  })

  it('caches for half a day and experation tests 1 - allowReturnExpiredValue: false', t => {
    t.mock.timers.enable()
    const cache = createCache({
      allowReturnExpiredValue: false,
      expirationTime: (dayInMilliseconds / 2),
      overrideMaxAllowedCacheTime: false
    })
    const cacheKey = 'weekEvictionTest'

    cache({ cacheKey, getValue: () => 'original data' })

    // Fast forward to just before expiration
    t.mock.timers.tick((dayInMilliseconds / 2) - 1)
    const result1 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result1).toBe('original data')

    // Fast forward past expiration
    t.mock.timers.tick(2)
    const result2 = cache({ cacheKey, getValue: () => 'new data' })
    expect(result2).toBe('new data')
  })

  it('caches for half a day and experation tests 2 - allowReturnExpiredValue: true', t => {
    t.mock.timers.enable()
    const cache = createCache({
      allowReturnExpiredValue: true,
      expirationTime: (dayInMilliseconds / 2),
      overrideMaxAllowedCacheTime: false
    })
    const cacheKey = 'weekEvictionTest'

    cache({ cacheKey, getValue: () => 'original data' })

    // Fast forward to just before expiration
    t.mock.timers.tick((dayInMilliseconds / 2) - 1)
    const result1 = cache({ cacheKey, getValue: () => 'new data 1' })
    expect(result1).toBe('original data')

    // Fast forward past expiration - expect stale data
    t.mock.timers.tick(2)
    const result2 = cache({ cacheKey, getValue: () => 'new data 2' })
    expect(result2).toBe('original data')

    // Call again - expect fresh data
    const result3 = cache({ cacheKey, getValue: () => 'new data 3' })
    expect(result3).toBe('new data 2')
  })

  it('caches for half a day and experation tests 3 - allowReturnExpiredValue: true', t => {
    t.mock.timers.enable()
    const cache = createCache({
      allowReturnExpiredValue: true,
      expirationTime: (dayInMilliseconds / 2),
      overrideMaxAllowedCacheTime: false
    })
    const cacheKey = 'weekEvictionTest'

    cache({ cacheKey, getValue: () => 'original data' })

    // Fast forward to just before expiration
    t.mock.timers.tick(dayInMilliseconds - 1)
    const result1 = cache({ cacheKey, getValue: () => 'new data 1' })
    expect(result1).toBe('original data')

    // Call again, expect fresh data (we are after half a day on previous call)
    const result2 = cache({ cacheKey, getValue: () => 'new data 2' })
    expect(result2).toBe('new data 1')

    // Fast forward past hard expiration
    t.mock.timers.tick(dayInMilliseconds + 1)
    // Call again - expect fresh data
    const result4 = cache({ cacheKey, getValue: () => 'new data 3' })
    expect(result4).toBe('new data 3')
  })
})

/** @arg {number} milliseconds @arg {string} [label] */
async function timeout(milliseconds, label = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

/** @template {SuiteContext | TestContext} T @arg {T} x @return {x is TestContext}  */
function isTestContext(x) { return Boolean('mock' in x) }

/**
 * @arg {any} x
 * @return {x is Mock<infer X>}
 */
function isMock(x) {
  return Boolean(
    x &&
    x['mock'] &&
    typeof x.mock.callCount === 'function'
  )
}

/** @arg {*} actual */
export function expect(actual) {

  return {
    /** @arg {*} expected */
    toBe(expected) {
      assert.strictEqual(actual, expected, `Expected ${actual} to be strictly equal to ${expected}`)
    },

    /** @arg {*} expected */
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected, `Expected ${actual} to equal (deeply) ${expected}`)
    },

    /** @arg {*} constructor */
    toBeInstanceOf(constructor) {
      assert.ok(actual instanceof constructor,
        `Expected ${actual} to be an instance of ${constructor.name}`)
    },

    /** @arg {number} count */
    toHaveBeenCalledTimes(count) {
      if (!isMock(actual))
        assert.fail(`toHaveBeenCalledTimes() requires a node:test mock function. Received: ${actual}`)

      const actualCount = actual.mock.callCount()
      assert.strictEqual(actualCount, count, `Expected mock function to be called ${count} times, but was called ${actualCount} times.`)
    },

    /** @arg {*} expected */
    toThrow(expected) {
      let didThrow = false
      try {
        actual()
      } catch (e) {
        didThrow = true
        // If an Error object was passed, compare the messages.
        if (expected instanceof Error && e instanceof Error) {
          assert.strictEqual(e.message, expected.message, `Expected error message "${expected.message}", but got "${e.message}"`)
        } else {
          // Fallback for strings or other types
          assert.strictEqual(e, expected)
        }
      }
      assert.ok(didThrow, 'Expected function to throw, it did not.')
    },

    rejects: {
      /** @arg {*} expected */
      async toEqual(expected) {
        let rejectionReason = null
        let rejected = false

        try {
          await actual
        } catch (e) {
          rejected = true
          rejectionReason = e
        }

        assert.ok(rejected, 'Expected promise to reject, but it resolved.')
        assert.strictEqual(rejectionReason.message, expected, `Expected rejection message "${expected}", but got "${rejectionReason.message}"`)
      }
    }
  }
}

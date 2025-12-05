import assert from 'node:assert'
import { createCache } from '../index.js' // eslint-disable-line @kaliber/no-relative-parent-import
import { beforeEach, describe, it } from 'node:test'
/** @import { SuiteContext, TestContext, Mock } from 'node:test' */

describe('createCache with expiredValues disabled', () => {
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

describe('createCache with expiredValues enabled', () => {
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
    await expect(result2).rejects.toEqual('this promise is rejected')
    const result3 = await cache({ cacheKey, getValue: rejectedCallback })
    expect(result3).toEqual(expectedOutput)
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

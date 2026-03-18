/** @import { CacheParams, Cache } from './types.ts' */

const dayInMilliseconds = 24 * 60 * 60 * 1000
const maxTimeoutValue = 0x7FFFFFFF // 32 bit signed integer

/** @arg {CacheParams} params */
export function createCache({ allowReturnExpiredValue, expirationTime }) {
  /** @type {Record<string, any>} */
  const cache = {}

  if (expirationTime > maxTimeoutValue)
    throw new Error(`Expiration time too large, max value: ${maxTimeoutValue}`)

  if (allowReturnExpiredValue && expirationTime >= dayInMilliseconds)
    console.trace('It is not possible to return expired items when expiration time is larger than one day')

  /** @type {Cache} */
  return function getCachedValue({ cacheKey, getValue }) {
    const now = Date.now()
    const safeCacheKey = JSON.stringify(cacheKey)
    const cachedItem = cache[safeCacheKey]

    const isValid = cachedItem && cachedItem.validUntil >= now
    if (isValid && allowReturnExpiredValue && cachedItem.isPending && cachedItem.previousValue !== undefined)
      return cachedItem.previousValue

    if (isValid)
      return cachedItem.value

    const callbackValue = getValue()
    const isPromise = isPromiseLike(callbackValue)

    if (cachedItem && cachedItem.timeoutId)
      clearTimeout(cachedItem.timeoutId)

    const hardExpirationTime = (
      allowReturnExpiredValue && expirationTime >= dayInMilliseconds ? expirationTime :
      allowReturnExpiredValue ? Math.min(dayInMilliseconds, expirationTime * 10) :
      expirationTime
    )

    const newCacheItem = {
      value: callbackValue,
      validUntil: now + expirationTime,
      isPending: isPromise,
      previousValue: isPromise ? cachedItem?.value : undefined,
      storedUntil: now + hardExpirationTime,
      timeoutId: deleteFromCacheTimeout(hardExpirationTime),
    }
    cache[safeCacheKey] = newCacheItem

    if (isPromise)
      callbackValue
        .then(
          _ => {
            newCacheItem.isPending = false
            newCacheItem.previousValue = undefined
          },
          () => {
            clearTimeout(newCacheItem.timeoutId)
            if (cache[safeCacheKey] !== newCacheItem)
              return

            if (!cachedItem)
              return deleteFromCache()

            const newHardExpirationTime = cachedItem.storedUntil - Date.now()
            const hasExpired = newHardExpirationTime <= 0
            if (hasExpired)
              return deleteFromCache()

            // the timeout was cleared before we fetched the value, so we need to create a new one
            cachedItem.timeoutId = deleteFromCacheTimeout(newHardExpirationTime)

            cache[safeCacheKey] = cachedItem
          }
        )

    return (cachedItem && allowReturnExpiredValue) ? cachedItem.value : newCacheItem.value

    /** @arg {number} milliseconds */
    function deleteFromCacheTimeout(milliseconds) {
      const timeout = setTimeout(deleteFromCache, milliseconds)
      timeout.unref?.()
      return timeout
    }

    function deleteFromCache() {
      delete cache[safeCacheKey]
    }
  }
}

/** @arg {*} x @returns {x is Promise<any>} */
function isPromiseLike(x) {
  return typeof x?.then === 'function'
}

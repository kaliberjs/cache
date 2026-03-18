/** @import { CacheParams, Cache } from './types.ts' */

/** @arg {CacheParams} params */
export function createCache({ allowReturnExpiredValue, expirationTime }) {
  /** @type {Record<string, any>} */
  const cache = {}

  /** @type {Cache} */
  return function getCachedValue({ cacheKey, getValue }) {
    const now = Date.now()
    const safeCacheKey = JSON.stringify(cacheKey)
    const cachedItem = cache[safeCacheKey]

    const isValid = cachedItem && cachedItem.validUntil >= now
    if (isValid) return cachedItem.value

    const callbackValue = getValue()

    const newCacheItem = { value: callbackValue, validUntil: now + expirationTime }
    cache[safeCacheKey] = newCacheItem

    if (hasCatchProperty(callbackValue)) callbackValue.catch(() => {
      if (cache[safeCacheKey] !== newCacheItem) return
      cache[safeCacheKey] = cachedItem
    })

    return (cachedItem && allowReturnExpiredValue) ? cachedItem.value : newCacheItem.value
  }
}

/** @arg {*} x @returns {x is { catch(f: (e: any) => void): any }} */
function hasCatchProperty(x) {
  return Boolean(x && x.catch)
}

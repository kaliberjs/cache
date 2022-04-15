/**
 * @param {import('./types').CacheParams} params
 */
export function createCache({ allowReturnExpiredValue, expirationTime }) {
  const cache = {}

  /**
   * @template T
   * @type {import('./types').Cache<T>}
   */
  return async function getCachedValue(getValue, { cacheKey }) {
    const now = Date.now()
    const safeCacheKey = JSON.stringify(cacheKey)
    const cachedItem = cache[safeCacheKey]

    const isValid = cachedItem && cachedItem.validUntil >= now
    if (isValid) return cachedItem.value

    const callbackResult = getValue()
    const callbackResultIsAnPromise = callbackResult instanceof Promise

    const newCacheItem = { value: null, validUntil: now + expirationTime }
    const returnCachedItem = cachedItem && allowReturnExpiredValue

    if (callbackResultIsAnPromise) {
      try {
        newCacheItem.value = await callbackResult

        cache[safeCacheKey] = newCacheItem
        return returnCachedItem ? cachedItem.value : newCacheItem.value
      } catch (e) {
        if (cachedItem) {
          return cachedItem.value
        } else {
          return new Error('no cached item to return!')
        }
      }
    } else {
      newCacheItem.value = callbackResult

      cache[safeCacheKey] = newCacheItem
      return returnCachedItem ? cachedItem.value : newCacheItem.value
    }
  }
}

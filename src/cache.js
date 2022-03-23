/**
 * @param {import('../types/types').CacheParams} params
 */
export function createCache({ allowReturnExpiredValue, expirationTime }) {
  const cache = {}

  /**
   * @template T
   * @type {import('../types/types').Cache<T>}
   */
  return function getCachedValue(getValue, { cacheKey }) {
    const now = Date.now()
    const safeCacheKey = JSON.stringify(cacheKey)
    const cachedItem = cache[safeCacheKey]

    const isValid = cachedItem && cachedItem.validUntil >= now
    if (isValid) return cachedItem.value

    const newCacheItem = { value: getValue(), validUntil: now + expirationTime }
    cache[safeCacheKey] = newCacheItem

    return cachedItem && allowReturnExpiredValue ? cachedItem.value : newCacheItem.value
  }
}

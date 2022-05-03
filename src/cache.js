/**
 * @param {import('./types').CacheParams} params
 */
export function createCache({ allowReturnExpiredValue, expirationTime }) {
  const cache = {}

  /**
   * @template T
   * @type {import('./types').Cache<T>}
   */
  return function getCachedValue(getValue, { cacheKey }) {
    const now = Date.now()
    const safeCacheKey = hashQueryKey(cacheKey)
    const cachedItem = cache[safeCacheKey]

    const isValid = cachedItem && cachedItem.validUntil >= now
    if (isValid) return cachedItem.value

    const callbackValue = getValue()

    const newCacheItem = { value: callbackValue, validUntil: now + expirationTime }
    cache[safeCacheKey] = newCacheItem

    if (callbackValue && 'catch' in callbackValue) callbackValue.catch(() => {
      if (cache[safeCacheKey] !== newCacheItem) return
      cache[safeCacheKey] = cachedItem
    })

    return (cachedItem && allowReturnExpiredValue) ? cachedItem.value : newCacheItem.value
  }
}

/**
 * @param {string | array} queryKey
 * @returns string
 */
export function hashQueryKey(queryKey) {
  const value = Array.isArray(queryKey) ? queryKey : [queryKey]

  return JSON.stringify(value, (_, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
        .sort()
        .reduce((result, key) => {
          result[key] = val[key]
          return result
        }, {})
      : val
  )
}

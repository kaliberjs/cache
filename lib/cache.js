"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCache = createCache;

/**
 * @param {import('./types').CacheParams} params
 */
function createCache(_ref) {
  var allowReturnExpiredValue = _ref.allowReturnExpiredValue,
      expirationTime = _ref.expirationTime;
  var cache = {};
  /**
   * @template T
   * @type {import('./types').Cache<T>}
   */

  return function getCachedValue(_ref2) {
    var cacheKey = _ref2.cacheKey,
        getValue = _ref2.getValue;
    var now = Date.now();
    var safeCacheKey = JSON.stringify(cacheKey);
    var cachedItem = cache[safeCacheKey];
    var isValid = cachedItem && cachedItem.validUntil >= now;
    if (isValid) return cachedItem.value;
    var callbackValue = getValue();
    var newCacheItem = {
      value: callbackValue,
      validUntil: now + expirationTime
    };
    cache[safeCacheKey] = newCacheItem;
    if (hasCatchProperty(callbackValue)) callbackValue.catch(() => {
      if (cache[safeCacheKey] !== newCacheItem) return;
      cache[safeCacheKey] = cachedItem;
    });
    return cachedItem && allowReturnExpiredValue ? cachedItem.value : newCacheItem.value;
  };
}
/** @returns {x is { catch(f: (e: any) => void): any }} */


function hasCatchProperty(x) {
  return Boolean(x && x.catch);
}
//# sourceMappingURL=cache.js.map
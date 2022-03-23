export type CacheParams = { allowReturnExpiredValue: boolean, expirationTime: number }
export type Cache<T> = (getValue: () => T, options: { cacheKey: string | Array<any> }) => T

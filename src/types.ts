export type CacheParams = { allowReturnExpiredValue: boolean, expirationTime: number, overrideMaxAllowedCacheTime?: boolean }
export type Cache = <T>(props: { cacheKey: string | Array<any>, getValue: () => T }) => T

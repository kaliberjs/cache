type Catchable<T> = T & { catch(callback: () => void): any }
export type CacheParams = { allowReturnExpiredValue: boolean, expirationTime: number }
export type Cache<T> = (getValue: () => T | Catchable<T>, options: { cacheKey: string | Array<any> }) => T

type Catchable<T> = T & { catch(callback: () => void): any }
export type CacheParams = { allowReturnExpiredValue: boolean, expirationTime: number }
export type Cache<T> = (props: { cacheKey: string | Array<any>, getValue: () => T | Catchable<T> }) => T

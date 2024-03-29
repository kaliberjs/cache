# Cache
Simple memory cache function.

## Motivation
Some times you want to cache a value but don't need a complex caching system. This package helps you cache values in side the memory of your application.

## Installation

```
yarn add @kaliber/cache
```

## Usage
```jsx
import fetch from 'node-fetch'
import { createCache } from '@kaliber/cache'

const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

function handleRequest(postId) {
  const data = cache({
    cacheKey: ['post', postId],
    async getValue() {
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`)
      return await response.json()
    }
  })

  return data
}
```

## createCache

| Property                | Value  | Description|
| ----------------------- | ------ | ---------- |
| allowReturnExpiredValue | false | if `false` the `expirationTime` will be leading in getting results from the cache |
| allowReturnExpiredValue | true | if `true` the cache is in 'unsafe' safe mode this means that the cache will always return a value even if the cache time is expired. Of course the cache needs to have a value to get value from it. |
| expirationTime          | number | (in milliseconds) this is the time the cache is valid. |

## Disclaimer
This library is intended for internal use, we provide __no__ support, use at your own risk.

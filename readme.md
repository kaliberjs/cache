# Cache
Simple memory cache function.

## Motivation
Some times you want to cache a value but don't need a complex caching system. This package helps you cache values in side the memory of your application.

## Installation

```
yarn add @kaliber/cache
```

## Usage
Short example. If your library has multiple ways to use it, show the most used one and refer to `/example` for further examples.

```jsx
import fetch from 'node-fetch'
import { createCache } from '@kaliber/cache'

const cache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

function handleRequest(postId) {
  const data = cache(async () => {
    const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`)
    return await response.json()
  }, {
    cacheKey: ['post', postId]
  })

  return data
}
```

## createCache
The createCache can be used in two ways `allowReturnExpiredValue: false` this means that the expirationTime will be leading in getting results from the cache. The other options is `allowReturnExpiredValue: true` this is a 'unsafe' cache this means that the cache will always return a value even if the cache time is expired. Of course the cache needs to have a value to get value from it.

## Disclaimer
This library is intended for internal use, we provide __no__ support, use at your own risk. It does not import React, but expects it to be provided, which [@kaliber/build](https://kaliberjs.github.io/build/) can handle for you.

This library is not transpiled.

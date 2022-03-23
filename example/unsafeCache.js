import { createCache } from '../src/cache.js'

const unsafeCache = createCache({ allowReturnExpiredValue: true, expirationTime: 1000 })

async function main() {
  test('0')

  await Promise.all([
    test('1'),
    test('2'),
    test('3'),
  ])

  await timeout(1000)
  await test('4')
  await timeout(1000)
  await test('5')
  await timeout(1000)
  await test('6')
}

async function test(label) {
  console.time(`test ${label}`)
  const result = await unsafeCache(() => timeout(250, label), { cacheKey: [23] })
  console.timeEnd(`test ${label}`)
  console.log(`done test ${label} - ${result}`)
}

main().catch((err) => console.error(err)).finally(() => {
  process.exit()
})

async function timeout(milliseconds, label) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(label), milliseconds)
  })
}

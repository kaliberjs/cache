import { createCache } from '../index.js'

const safeCache = createCache({ allowReturnExpiredValue: false, expirationTime: 1000 })

async function main() {
  createTestWithLabel('0')

  await Promise.all([
    createTestWithLabel('1'),
    createTestWithLabel('2'),
    createTestWithLabel('3'),
  ])

  await timeout(1000)
  await createTestWithLabel('4')
  await timeout(1000)
  await createTestWithLabel('5')
  await timeout(1000)
  await createTestWithLabel('6')
}

async function createTestWithLabel(label) {
  console.time(`test ${label}`)
  const result = await safeCache(() => timeout(250, label), { cacheKey: [23, { floep: 'flap' }] })
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

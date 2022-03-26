import { createCache } from '../index.js'

const unsafeCache = createCache({ allowReturnExpiredValue: true, expirationTime: 1000 })

async function main() {
  createATestWithLabel('0')

  await Promise.all([
    createATestWithLabel('1'),
    createATestWithLabel('2'),
    createATestWithLabel('3'),
  ])

  await timeout(1000)
  await createATestWithLabel('4')
  await timeout(1000)
  await createATestWithLabel('5')
  await timeout(1000)
  await createATestWithLabel('6')
}

async function createATestWithLabel(label) {
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

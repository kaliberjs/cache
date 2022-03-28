import { expect, it } from '@jest/globals'
import { hashQueryKey } from '../index'

it('should hash a array with objects', () => {
  expect(hashQueryKey(['test', ['hallo'], { a: 1, b: 'b' }])).toEqual(hashQueryKey(['test', ['hallo'], { b: 'b', a: 1 }]))

  const output = hashQueryKey('test')
  expect(output).toEqual("[\"test\"]")
})

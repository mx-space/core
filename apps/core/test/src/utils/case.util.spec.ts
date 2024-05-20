import snakecaseKeys from 'snakecase-keys'

test('snakecase', () => {
  class A {
    a = 1
    bA = 2
  }
  expect(snakecaseKeys(new A() as any)).toEqual({ a: 1, b_a: 2 })
})

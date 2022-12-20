import { autoBind } from '~/utils/auto-bind'

describe('test auto bind', () => {
  it('should bind in class', () => {
    class A {
      constructor() {
        autoBind(this)
      }
      name = 'A'
      foo() {
        return this?.name
      }
    }

    expect(new A().foo()).toBe('A')

    function tester(caller: any) {
      return caller()
    }
    expect(tester(new A().foo)).toBe('A')

    function tester2<T extends (...args: any) => any>(caller: T) {
      return caller.call({})
    }
    expect(tester2(new A().foo)).toBe('A')
  })
})

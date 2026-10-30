import { describe, expect, it } from 'vitest'

import { RippleMotion } from './ripple-motion'

describe('RippleMotion', () => {
  it('changes the rendered field gradually rather than replacing it', () => {
    const motion = new RippleMotion([0, 10])
    motion.setTarget([10, 0])
    expect([...motion.values]).toEqual([0, 10])
    motion.advance(100)
    expect(motion.values[0]).toBeGreaterThan(0)
    expect(motion.values[0]).toBeLessThan(10)
    expect(motion.values[1]).toBeGreaterThan(0)
    expect(motion.values[1]).toBeLessThan(10)
  })

  it('continues from the rendered shape when a transition is interrupted', () => {
    const motion = new RippleMotion([0])
    motion.setTarget([10])
    motion.advance(100)
    const halfway = motion.values[0]
    motion.setTarget([-10])
    expect(motion.values[0]).toBe(halfway)
    motion.advance(16)
    expect(motion.values[0]).toBeLessThan(halfway)
    expect(motion.values[0]).toBeGreaterThan(-10)
    for (let i = 0; i < 80; i++) motion.advance(32)
    expect(motion.values[0]).toBeCloseTo(-10, 2)
  })

  it('moves at the same speed across different frame rates', () => {
    const fast = new RippleMotion([0])
    const slow = new RippleMotion([0])
    fast.setTarget([10])
    slow.setTarget([10])
    for (let i = 0; i < 60; i++) fast.advance(16)
    for (let i = 0; i < 30; i++) slow.advance(32)
    expect(fast.values[0]).toBeCloseTo(slow.values[0], 4)
  })

  it('can reach the requested scene immediately without ongoing motion', () => {
    const motion = new RippleMotion([0, 1])
    motion.setTarget([8, 3], true)
    expect([...motion.values]).toEqual([8, 3])
    motion.advance(100)
    expect([...motion.values]).toEqual([8, 3])
  })
})

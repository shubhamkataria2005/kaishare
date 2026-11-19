import { describe, expect, it } from 'vitest'
import { getTransition, isActive, nextStatuses } from '../../src/services/claimStateMachine.js'

describe('claim state machine', () => {
  it('lets a donor confirm or decline a pending claim', () => {
    expect(nextStatuses('pending').sort()).toEqual(['confirmed', 'declined'])
    expect(getTransition('pending', 'confirmed').by).toContain('donor')
  })

  it('frees the listing when a claim is declined', () => {
    expect(getTransition('pending', 'declined').listing).toEqual({ from: 'reserved', to: 'available' })
  })

  it('marks the listing collected when a confirmed claim is collected', () => {
    expect(getTransition('confirmed', 'collected').listing).toEqual({ from: 'reserved', to: 'collected' })
  })

  it.each([
    ['pending', 'collected'],
    ['declined', 'confirmed'],
    ['collected', 'declined'],
    ['confirmed', 'pending'],
  ])('does not allow %s -> %s', (from, to) => {
    expect(getTransition(from, to)).toBeNull()
  })

  it('never lets a rescuer change a status', () => {
    for (const from of ['pending', 'confirmed']) {
      for (const to of nextStatuses(from)) {
        expect(getTransition(from, to).by).not.toContain('rescuer')
      }
    }
  })

  it('treats pending and confirmed claims as active', () => {
    expect(['pending', 'confirmed', 'declined', 'collected'].map(isActive)).toEqual([true, true, false, false])
  })
})

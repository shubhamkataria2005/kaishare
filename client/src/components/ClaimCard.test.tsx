import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { claimRepository } from '../data/claimRepository'
import { fakeAuth, renderWithAuth, testUser } from '../test/renderWithAuth'
import type { Claim } from '../types'
import { ClaimCard } from './ClaimCard'

const HOUR = 60 * 60 * 1000
const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'claim-1',
  listingId: 'listing-1',
  listing: {
    title: 'Sourdough loaves',
    quantity: 18,
    unit: 'loaves',
    address: '112 Ponsonby Road',
    suburb: 'Ponsonby',
    pickupStart: new Date(Date.now() - HOUR).toISOString(),
    pickupEnd: new Date(Date.now() + 4 * HOUR).toISOString(),
    status: 'reserved',
  },
  rescuerId: 'rescuer-1',
  rescuerName: 'Tama',
  donorId: 'donor-1',
  pickupTime: new Date(Date.now() + HOUR).toISOString(),
  note: 'Blue van',
  status: 'pending',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

const asRescuer = fakeAuth({ user: testUser({ id: 'rescuer-1', role: 'rescuer' }) })
const asDonor = fakeAuth({ user: testUser({ id: 'donor-1', role: 'donor' }) })

describe('ClaimCard', () => {
  it('lets the rescuer change or cancel, but not confirm', () => {
    renderWithAuth(<ClaimCard claim={claim()} onChanged={vi.fn()} />, { auth: asRescuer })
    expect(screen.getByRole('button', { name: 'Change time or note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel claim' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm pickup' })).not.toBeInTheDocument()
  })

  it('lets the donor confirm a pending claim', async () => {
    const update = vi.spyOn(claimRepository, 'update').mockResolvedValue({ queued: false, data: { claim: claim({ status: 'confirmed' }) } })
    const onChanged = vi.fn()
    renderWithAuth(<ClaimCard claim={claim()} onChanged={onChanged} />, { auth: asDonor })

    await userEvent.click(screen.getByRole('button', { name: 'Confirm pickup' }))

    expect(update).toHaveBeenCalledWith('donor-1', 'claim-1', { status: 'confirmed' }, 'Sourdough loaves')
    expect(onChanged).toHaveBeenCalled()
    expect(await screen.findByText('Pickup confirmed.')).toBeInTheDocument()
  })

  it('offers "Mark collected" once confirmed', () => {
    renderWithAuth(<ClaimCard claim={claim({ status: 'confirmed' })} onChanged={vi.fn()} />, { auth: asDonor })
    expect(screen.getByRole('button', { name: 'Mark collected' })).toBeInTheDocument()
  })

  it('tells the user when a change was saved offline', async () => {
    vi.spyOn(claimRepository, 'update').mockResolvedValue({ queued: true })
    renderWithAuth(<ClaimCard claim={claim()} onChanged={vi.fn()} />, { auth: asDonor })
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(await screen.findByText(/Saved offline/)).toBeInTheDocument()
  })

  it('validates a new pickup time before saving', async () => {
    const update = vi.spyOn(claimRepository, 'update')
    renderWithAuth(<ClaimCard claim={claim()} onChanged={vi.fn()} />, { auth: asRescuer })
    await userEvent.click(screen.getByRole('button', { name: 'Change time or note' }))
    const input = screen.getByLabelText('New pickup time')
    await userEvent.clear(input)
    await userEvent.type(input, '2020-01-01T10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Choose a time inside the pickup window.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError'
import { ListingForm } from './ListingFormPage'
import { emptyListingForm, toListingInput } from './listingFormModel'

describe('toListingInput', () => {
  it('converts the form values to the API format', () => {
    const input = toListingInput({
      ...emptyListingForm(new Date('2026-11-20T01:00:00Z')),
      title: '  Bread ',
      category: 'bakery',
      quantity: '12',
      unit: 'loaves',
      address: '1 Queen St',
      suburb: 'CBD',
    })
    expect(input.title).toBe('Bread')
    expect(input.quantity).toBe(12)
    expect(input.pickupStart).toMatch(/Z$/)
  })

  it('turns an empty quantity into NaN so validation catches it', () => {
    expect(toListingInput({ ...emptyListingForm(), quantity: '' }).quantity).toBeNaN()
  })
})

describe('ListingForm', () => {
  it('shows every problem and does not submit an incomplete listing', async () => {
    const onSubmit = vi.fn()
    render(<ListingForm initial={emptyListingForm()} submitLabel="Post listing" onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Post listing' }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Choose a category.')).toBeInTheDocument()
    expect(screen.getByText('Choose a unit.')).toBeInTheDocument()
    expect(screen.getByText('Quantity must be a whole number.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a complete listing with the chosen dietary tags', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ListingForm initial={emptyListingForm()} submitLabel="Post listing" onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('What food is it?'), 'Sourdough loaves')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'bakery')
    await userEvent.type(screen.getByLabelText('Quantity'), '18')
    await userEvent.selectOptions(screen.getByLabelText('Unit'), 'loaves')
    await userEvent.click(screen.getByLabelText('Vegan'))
    await userEvent.type(screen.getByLabelText('Pickup address'), '112 Ponsonby Road')
    await userEvent.type(screen.getByLabelText('Suburb'), 'Ponsonby')
    await userEvent.click(screen.getByRole('button', { name: 'Post listing' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sourdough loaves', category: 'bakery', quantity: 18, unit: 'loaves', dietaryTags: ['vegan'] }),
    )
  })

  it('shows field errors returned by the server', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('Please correct the pickup times.', 400, { pickupEnd: 'Pickup end must be in the future.' }))
    render(
      <ListingForm
        initial={{ ...emptyListingForm(), title: 'Bread', category: 'bakery', quantity: '2', unit: 'loaves', address: '1 Queen St', suburb: 'CBD' }}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Pickup end must be in the future.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Please correct the pickup times.')
  })
})

import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './pushSubscription'

describe('urlBase64ToUint8Array', () => {
  it('decodes a URL-safe base64 VAPID key to 65 bytes', () => {
    const key = 'BOFKnieU88uHhK6dCl8ZHxr-xXZ5IvAe9LKqFrsr3IGTDQ2ob5viM4QBjOkVCALR9ID06oIPg83bdWLFCBNkDj0'
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes).toHaveLength(65)
    // An uncompressed P-256 public key always starts with 0x04.
    expect(bytes[0]).toBe(4)
  })

  it('handles the - and _ characters of URL-safe base64', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255])
  })
})

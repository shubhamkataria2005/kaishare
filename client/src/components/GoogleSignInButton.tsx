/**
 * "Sign in with Google" (Google Identity Services, OAuth 2 / OpenID Connect).
 *
 * Google's script shows the button and, after the user signs in, gives
 * back an ID token (a JWT signed by Google). The token is sent to our API,
 * which verifies its signature, audience and expiry with Google's public
 * keys before trusting it. The client id comes from the API
 * (/api/auth/providers), so it is configured in one place.
 *
 * The button is hidden when the server has no Google client id.
 */
import { useEffect, useRef, useState } from 'react'
import { authApi } from '../api/authApi'
import { createLogger } from '../utils/logger'

const log = createLogger('google')
const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: string }) => void
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface Props {
  onCredential: (credential: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

export function GoogleSignInButton({ onCredential, text = 'continue_with' }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  useEffect(() => {
    callback.current = onCredential
  }, [onCredential])
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    authApi
      .providers()
      .then((providers) => setClientId(providers.google.enabled ? providers.google.clientId : null))
      .catch(() => setClientId(null))
  }, [])

  useEffect(() => {
    if (!clientId || !navigator.onLine) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callback.current(response.credential),
        })
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: 320,
        })
      })
      .catch((error) => log.warn(error.message))
    return () => {
      cancelled = true
    }
  }, [clientId, text])

  if (!clientId) return null
  return (
    <div className="google-signin">
      <div className="divider">
        <span>or</span>
      </div>
      <div ref={container} className="google-button" />
    </div>
  )
}

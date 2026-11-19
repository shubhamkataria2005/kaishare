/** Page frame: header with role-based navigation, banners, and the page. */
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOutboxSync } from '../hooks/useOutboxSync'
import { applyUpdate, PWA_EVENTS } from '../pwa/registerServiceWorker'
import { useToast } from './toast/useToast'

export function Layout() {
  const { user, status, logout } = useAuth()
  const online = useOnlineStatus()
  const queued = useOutboxSync()
  const toast = useToast()
  const navigate = useNavigate()
  const [updateReady, setUpdateReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onNeedRefresh = () => setUpdateReady(true)
    const onOfflineReady = () => toast.info('KaiShare is ready to work offline.')
    window.addEventListener(PWA_EVENTS.NEED_REFRESH, onNeedRefresh)
    window.addEventListener(PWA_EVENTS.OFFLINE_READY, onOfflineReady)
    return () => {
      window.removeEventListener(PWA_EVENTS.NEED_REFRESH, onNeedRefresh)
      window.removeEventListener(PWA_EVENTS.OFFLINE_READY, onOfflineReady)
    }
  }, [toast])

  // Show push messages in the page too while the app is open.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        toast.info(`🔔 ${event.data.payload.title}: ${event.data.payload.body}`)
        window.dispatchEvent(new Event('kaishare:data-changed'))
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [toast])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="KaiShare home">
            <img src="/favicon.svg" alt="" width="32" height="32" />
            <span>KaiShare</span>
          </Link>

          {user && (
            <>
              <button
                type="button"
                className="menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="main-nav"
                onClick={() => setMenuOpen((open) => !open)}
              >
                Menu
              </button>
              <nav id="main-nav" className={menuOpen ? 'nav open' : 'nav'} aria-label="Main" onClick={() => setMenuOpen(false)}>
                <NavLink to="/" end className={navClass}>
                  Browse food
                </NavLink>
                {user.role === 'donor' && (
                  <NavLink to="/my-listings" className={navClass}>
                    My listings
                  </NavLink>
                )}
                {user.role === 'donor' && (
                  <NavLink to="/listings/new" className={navClass}>
                    + New listing
                  </NavLink>
                )}
                <NavLink to="/claims" className={navClass}>
                  {user.role === 'rescuer' ? 'My pickups' : 'Pickup requests'}
                </NavLink>
                <NavLink to="/profile" className={navClass}>
                  Profile
                </NavLink>
                <button type="button" className="nav-link nav-button" onClick={handleLogout}>
                  Sign out
                </button>
              </nav>
            </>
          )}
        </div>
      </header>

      {(!online || status === 'offline') && (
        <div className="banner banner-offline" role="status">
          <strong>Offline mode.</strong> You are seeing saved data. Changes are queued and sent automatically when you reconnect.
        </div>
      )}
      {queued > 0 && online && status === 'authenticated' && (
        <div className="banner banner-sync" role="status">
          Sending {queued} saved change{queued === 1 ? '' : 's'}…
        </div>
      )}
      {queued > 0 && (!online || status === 'offline') && (
        <div className="banner banner-sync" role="status">
          {queued} change{queued === 1 ? '' : 's'} waiting to be sent.
        </div>
      )}
      {updateReady && (
        <div className="banner banner-update" role="status">
          A new version of KaiShare is available.
          <button type="button" className="button button-small" onClick={applyUpdate}>
            Update now
          </button>
        </div>
      )}

      <main className="main" id="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>KaiShare · Rescuing surplus kai across Tāmaki Makaurau</p>
      </footer>
    </div>
  )
}

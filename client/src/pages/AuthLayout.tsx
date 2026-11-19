import type { ReactNode } from 'react'

/** Two-column frame for the sign-in and register pages. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-hero" aria-hidden="true">
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h2>Good kai should feed people, not landfill.</h2>
        <p>
          Cafés, bakeries and grocers post what they have left at the end of the day. Food banks, charities and volunteers
          claim it and pick it up before it goes to waste.
        </p>
        <ul>
          <li>🥖 Post surplus in under a minute</li>
          <li>🔔 Rescuers are notified instantly</li>
          <li>📶 Works offline on the road</li>
        </ul>
      </aside>
      <section className="auth-card">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  )
}

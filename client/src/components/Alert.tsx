import type { ReactNode } from 'react'

interface Props {
  kind?: 'error' | 'success' | 'info' | 'warning'
  children: ReactNode
}

export function Alert({ kind = 'info', children }: Props) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

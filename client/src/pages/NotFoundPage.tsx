import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState icon="🧭" title="Page not found">
      <Link to="/">Go back to the listings</Link>
    </EmptyState>
  )
}

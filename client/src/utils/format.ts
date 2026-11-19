/** Date and time formatting for New Zealand users. */

const TIME_ZONE = 'Pacific/Auckland'

const dateTime = new Intl.DateTimeFormat('en-NZ', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

const timeOnly = new Intl.DateTimeFormat('en-NZ', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' })

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value))
}

/** "Thu 20 Nov, 2:00 pm – 6:00 pm", or both full dates when the window spans days. */
export function formatWindow(start: string | Date, end: string | Date): string {
  const sameDay = dayKey.format(new Date(start)) === dayKey.format(new Date(end))
  return sameDay ? `${formatDateTime(start)} – ${timeOnly.format(new Date(end))}` : `${formatDateTime(start)} – ${formatDateTime(end)}`
}

/** "in 3 hours", "in 25 minutes", "ended" */
export function formatTimeLeft(end: string | Date, now: Date = new Date()): string {
  const minutes = Math.round((new Date(end).getTime() - now.getTime()) / 60000)
  if (minutes <= 0) return 'ended'
  if (minutes < 60) return `${minutes} min left`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h left`
  return `${Math.round(hours / 24)} days left`
}

/**
 * Converts a Date to the "YYYY-MM-DDTHH:mm" value a datetime-local input
 * expects, in the browser's local time zone.
 */
export function toDateTimeLocal(value: string | Date): string {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Converts a datetime-local value back to an ISO string (UTC) for the API. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString()
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

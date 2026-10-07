import { formatEthiopian } from './ethiopianCalendar'

const birr = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('en')

/** ETB 1,250.00 */
export const money = (value, { symbol = 'ETB', compact: short = false } = {}) => {
  const n = Number(value || 0)
  const amount = short && Math.abs(n) >= 10000 ? compact.format(n) : birr.format(n)
  // Non-breaking space: "ETB 7.50" never wraps across lines
  return symbol ? `${symbol} ${amount}` : amount
}

export const number = (value) => integer.format(Number(value || 0))
export const compactNumber = (value) => compact.format(Number(value || 0))

const parse = (value) => (value instanceof Date ? value : new Date(value))

export function date(value, { calendar = 'gregorian', locale = 'en', withTime = false } = {}) {
  if (!value) return '—'
  const d = parse(value)
  if (Number.isNaN(d.getTime())) return '—'
  if (calendar === 'ethiopian') return formatEthiopian(d, locale)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export const time = (value) => (value ? parse(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')

export function relative(value) {
  if (!value) return ''
  const seconds = Math.round((parse(value).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/** +251911223344 -> 0911 223 344 */
export function phone(value) {
  if (!value) return '—'
  const digits = String(value).replace(/\D/g, '')
  const local = digits.startsWith('251') ? '0' + digits.slice(3) : digits
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : value
}

export const titleCase = (value) => String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const initials = (name) =>
  String(name || '?')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
export const addDaysIso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

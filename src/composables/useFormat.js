import { storeToRefs } from 'pinia'
import * as f from '@/lib/format'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import { locale } from '@/lib/i18n'
import { useUiStore } from '@/stores/ui'

/**
 * Formatting helpers that respect the user's calendar preference (Gregorian / Ethiopian) and language.
 */
export function useFormat() {
  const { calendar } = storeToRefs(useUiStore())

  const date = (value, opts = {}) => f.date(value, { calendar: calendar.value, locale: locale.value, ...opts })
  const dateTime = (value) => (calendar.value === 'ethiopian' ? `${date(value)} · ${f.time(value)}` : f.date(value, { withTime: true }))
  /** The "other" calendar, for tooltips. */
  const altDate = (value) => (calendar.value === 'ethiopian' ? f.date(value) : formatEthiopian(value, locale.value))

  return { ...f, date, dateTime, altDate }
}

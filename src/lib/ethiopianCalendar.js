/**
 * Gregorian <-> Ethiopian (Amete Mihret) calendar conversion via Julian Day Numbers.
 * Ethiopia uses 12 months of 30 days plus Pagume (5 or 6 days); the year starts on Meskerem 1
 * (11 or 12 September) and is 7-8 years behind the Gregorian year.
 */

const JD_EPOCH = 1723856 // Julian day of Meskerem 1, year 1 (Amete Mihret)

export const ETHIOPIAN_MONTHS = {
  en: ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'],
  am: ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'],
}

export const ETHIOPIAN_WEEKDAYS = {
  en: ['Ehud', 'Segno', 'Maksegno', 'Rob', 'Hamus', 'Arb', 'Kidame'],
  am: ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'],
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  }
}

/** @returns {{year:number, month:number, day:number}} Ethiopian date (month 1-13) */
export function toEthiopian(date) {
  const d = date instanceof Date ? date : new Date(date)
  const jdn = gregorianToJdn(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const r = (jdn - JD_EPOCH) % 1461
  const n = (r % 365) + 365 * Math.floor(r / 1460)
  return {
    year: 4 * Math.floor((jdn - JD_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  }
}

export function fromEthiopian(year, month, day) {
  const jdn = JD_EPOCH + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31
  const g = jdnToGregorian(jdn)
  return new Date(g.year, g.month - 1, g.day)
}

/** "Meskerem 27, 2019 E.C." / "መስከረም 27 ቀን 2019 ዓ.ም." */
export function formatEthiopian(date, locale = 'en', { weekday = false } = {}) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const { year, month, day } = toEthiopian(d)
  const lang = locale === 'am' ? 'am' : 'en'
  const name = ETHIOPIAN_MONTHS[lang][month - 1]
  const wd = weekday ? `${ETHIOPIAN_WEEKDAYS[lang][d.getDay()]}, ` : ''
  return lang === 'am' ? `${wd}${name} ${day} ቀን ${year} ዓ.ም.` : `${wd}${name} ${day}, ${year} E.C.`
}

/**
 * Ethiopian clock: the day starts at sunrise (6:00 AM = 12:00 / "1 ሰዓት" counting from dawn).
 * 08:30 -> 2:30 (morning)
 */
export function ethiopianTime(date, locale = 'en') {
  const d = date instanceof Date ? date : new Date(date)
  let h = (d.getHours() + 6) % 12
  if (h === 0) h = 12
  const m = String(d.getMinutes()).padStart(2, '0')
  const hour24 = d.getHours()
  const period =
    locale === 'am'
      ? hour24 >= 6 && hour24 < 12 ? 'ጠዋት' : hour24 >= 12 && hour24 < 18 ? 'ከሰዓት' : hour24 >= 18 ? 'ማታ' : 'ሌሊት'
      : hour24 >= 6 && hour24 < 18 ? 'day' : 'night'
  return `${h}:${m} ${period}`
}

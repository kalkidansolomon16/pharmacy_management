/** "First month free" for a 30-day trial, "14 days free" otherwise; null when a plan has no free trial. */
export function trialLabel(days) {
  const d = Number(days || 0)
  if (d <= 0) return null
  if (d >= 28 && d <= 31) return 'First month free'
  if (d % 30 === 0) return `First ${d / 30} months free`
  return `${d} days free`
}

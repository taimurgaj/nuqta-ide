const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function toUrduNumerals(n: number): string {
  return String(n).replace(/\d/g, d => URDU_DIGITS[Number(d)] ?? d)
}

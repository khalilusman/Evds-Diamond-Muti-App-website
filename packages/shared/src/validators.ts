// Activation code: 6-8 uppercase alphanumeric, no O/0/I/1/L
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,8}$/

export function isValidActivationCode(code: string): boolean {
  return CODE_REGEX.test(code)
}

export function isValidFullCode(fullCode: string): boolean {
  // format: YYYYMMDD-FAMILYABBREVDIA-CODE
  const parts = fullCode.split('-')
  if (parts.length !== 3) return false
  const [lot, _familyDia, code] = parts
  if (!/^\d{8}$/.test(lot)) return false
  return isValidActivationCode(code)
}

export { CODE_ALPHABET }

const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/

// This is the canonical format supplied by PhoneInput: country dial code plus
// national digits, with no presentation characters.
export const normalizePhone = (value: unknown) => String(value ?? '').replace(/[\s()-]/g, '')

export const isInternationalPhone = (phone: string) => INTERNATIONAL_PHONE.test(phone)

// Authentication uses an internal email identifier; the phone itself is never
// used as an email address. Keep every digit, including the country dial code.
export const internalEmailForPhone = (phone: string) =>
  `parent-${normalizePhone(phone).replace(/\D/g, '')}@portal.reliance.local`

export const studentInternalEmailForPhone = (phone: string) =>
  `student-${normalizePhone(phone).replace(/\D/g, '')}@portal.reliance.local`

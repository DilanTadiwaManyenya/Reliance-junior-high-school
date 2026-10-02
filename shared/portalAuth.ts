const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/

/** Canonical phone form for portal authentication and profile storage. */
export const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

export const isInternationalPhone = (phone: string) => INTERNATIONAL_PHONE.test(phone)

// This internal identifier is role- and login-page-independent.
export const buildPortalEmail = (phone: unknown) => {
  const digits = normalizePhone(phone).replace(/^\+/, '')
  return `portal-${digits}@portal.reliance.local`
}

// Student access is identified by the school admission number, so a learner
// does not need to own or share a phone in order to use the portal.
export const buildStudentPortalEmail = (admissionNumber: unknown) =>
  `student-${String(admissionNumber ?? '').trim()}@portal.reliance.local`

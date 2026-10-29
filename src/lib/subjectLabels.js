const normalize = value => String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')

const seniorAliases = new Map([
  ['english', 'englishlanguage'],
  ['shona', 'chishona'],
  ['heritage', 'heritagestudies'],
])

// These names are aliases in the Senior curriculum. Junior report books use
// their own subject labels, so their subject matching remains literal.
export function subjectIdentityKey(label, { campus = '', class_level = '' } = {}) {
  const key = normalize(label)
  const senior = campus === 'senior' || /^form\s/i.test(class_level) || /six$/i.test(class_level)
  return senior ? seniorAliases.get(key) || key : key
}

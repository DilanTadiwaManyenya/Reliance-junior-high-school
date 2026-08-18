import { useMemo, useState } from 'react'
import { FiCheckCircle, FiSearch } from 'react-icons/fi'
import { countryCodes, defaultCountry } from '../../data/countryCodes'
import { isInternationalPhone, normalizePhone } from '../../../shared/portalPhone'

export default function PhoneInput({ id = 'phone', label = 'Phone number', value, onChange, required = false }) {
  const initialCountry = [...countryCodes].sort((a, b) => b.dialCode.length - a.dialCode.length).find(item => value?.startsWith(item.dialCode))
  const [country, setCountry] = useState(() => initialCountry ?? defaultCountry)
  const [digits, setDigits] = useState(() => initialCountry ? value.slice(initialCountry.dialCode.length).replace(/\D/g, '') : '')
  const [search, setSearch] = useState('')
  const normalized = isInternationalPhone(normalizePhone(`${country.dialCode}${digits}`))
  const filteredCountries = useMemo(() => countryCodes.filter(item => `${item.name} ${item.dialCode}`.toLowerCase().includes(search.toLowerCase())), [search])
  const updateDigits = (event) => { const next = event.target.value.replace(/\D/g, ''); setDigits(next); onChange(`${country.dialCode}${next}`) }
  const changeCountry = (event) => { const next = countryCodes.find(item => item.country === event.target.value) ?? defaultCountry; setCountry(next); onChange(`${next.dialCode}${digits}`) }
  return <div className={`phone-input ${digits ? (normalized ? 'is-valid' : 'is-invalid') : ''}`}><label htmlFor={id}>{label}</label><div className="phone-input-controls"><div className="phone-country"><div className="phone-search"><FiSearch aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find country" aria-label="Search country" /></div><select value={country.country} onChange={changeCountry} aria-label="Country calling code">{filteredCountries.map(item => <option key={item.country} value={item.country}>{item.flag} {item.name} {item.dialCode}</option>)}</select></div><div className="phone-number"><span>{country.dialCode}</span><input id={id} type="tel" value={digits} onChange={updateDigits} inputMode="numeric" autoComplete="tel-national" placeholder="77 123 4567" required={required} aria-describedby={`${id}-help`} />{digits && (normalized ? <FiCheckCircle className="phone-status" aria-label="Valid number" /> : <span className="phone-status phone-invalid-mark" aria-label="Enter more digits">!</span>)}</div></div><small id={`${id}-help`}>{digits && !normalized ? 'Enter a valid number length for the selected country code.' : `Use digits only. ${country.name} is selected.`}</small></div>
}

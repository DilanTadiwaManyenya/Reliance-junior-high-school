import { useEffect, useRef, useState } from 'react'
import { parseTypedBirthDate } from '../../../shared/studentRegistration.js'

const displayValue = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

export default function DateOfBirthInput({ value = '', onChange, required = false, disabled = false, id, className = '' }) {
  const [draft, setDraft] = useState(() => displayValue(value))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef(null)
  const previousValue = useRef(value || '')

  useEffect(() => {
    const nextValue = value || ''
    if (nextValue !== previousValue.current) {
      previousValue.current = nextValue
      setDraft(displayValue(nextValue))
      setInvalid(false)
    }
  }, [value])

  const emit = (nextValue) => {
    if (nextValue === previousValue.current) return
    previousValue.current = nextValue
    onChange?.({ target: { value: nextValue } })
  }

  const updateDraft = (event) => {
    const nextDraft = event.target.value.slice(0, 10)
    const parsed = parseTypedBirthDate(nextDraft)
    setDraft(nextDraft)
    const hasInput = Boolean(nextDraft.trim())
    setInvalid(hasInput && !parsed)
    event.target.setCustomValidity(hasInput && !parsed ? 'Enter a real date as DD/MM/YYYY or DDMMYYYY.' : '')
    emit(parsed)
  }

  const handleBlur = () => {
    const parsed = parseTypedBirthDate(draft)
    if (parsed) setDraft(displayValue(parsed))
    setInvalid(Boolean(draft.trim()) && !parsed)
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return
    if (typeof picker.showPicker === 'function') picker.showPicker()
    else { picker.focus(); picker.click() }
  }

  const pickerChanged = (event) => {
    const nextValue = event.target.value
    setDraft(displayValue(nextValue))
    setInvalid(false)
    emit(nextValue)
  }

  return <div className={`dob-entry ${className}`.trim()}>
    <input
      id={id}
      className="dob-entry-text"
      type="text"
      inputMode="numeric"
      autoComplete="bday"
      placeholder="DD/MM/YYYY or DDMMYYYY"
      value={draft}
      required={required}
      disabled={disabled}
      maxLength={10}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? `${id}-hint` : undefined}
      onChange={updateDraft}
      onBlur={handleBlur}
    />
    <button className="dob-entry-calendar" type="button" aria-label="Choose date of birth from calendar" onClick={openPicker} disabled={disabled}>Calendar</button>
    <input ref={pickerRef} className="dob-entry-native" type="date" value={value || ''} max={new Date().toISOString().slice(0, 10)} tabIndex={-1} aria-hidden="true" onChange={pickerChanged} />
    <small id={id ? `${id}-hint` : undefined} className="dob-entry-hint">Type the date or choose it from the calendar.</small>
  </div>
}

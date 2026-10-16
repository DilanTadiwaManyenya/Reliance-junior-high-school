import { useId, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

export default function PasswordInput({ label, value, onChange, autoComplete, minLength = 8, required = false, id }) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  return <label className="password-input" htmlFor={inputId}>{label}<span><input id={inputId} type={visible ? 'text' : 'password'} minLength={minLength} value={value} onChange={onChange} autoComplete={autoComplete} required={required} /><button type="button" onClick={() => setVisible(current => !current)} aria-controls={inputId} aria-pressed={visible} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <FiEyeOff /> : <FiEye />}</button></span></label>
}

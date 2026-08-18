import { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

export default function PasswordInput({ label, value, onChange, autoComplete, minLength = 8, required = false, id }) {
  const [visible, setVisible] = useState(false)
  return <label className="password-input" htmlFor={id}>{label}<span><input id={id} type={visible ? 'text' : 'password'} minLength={minLength} value={value} onChange={onChange} autoComplete={autoComplete} required={required} /><button type="button" onClick={() => setVisible(current => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <FiEyeOff /> : <FiEye />}</button></span></label>
}

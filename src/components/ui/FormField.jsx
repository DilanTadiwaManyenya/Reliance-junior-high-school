import { Children, cloneElement, useId } from 'react'

// One labelled native input/select/textarea. Existing descriptions remain associated.
export default function FormField({ label, hint, error, required = false, children }) {
  const generatedId = useId()
  const control = Children.only(children)
  const id = control.props.id || generatedId
  const description = [control.props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return <div className="ui-form-field">
    <label htmlFor={id}>{label}{(required || control.props.required) && <span className="ui-field-required"> (required)</span>}</label>
    {hint && <p id={`${id}-hint`} className="ui-field-hint">{hint}</p>}
    {cloneElement(control, { id, className: `ui-field-control ${control.props.className || ''}`, required: required || control.props.required, 'aria-describedby': description, 'aria-invalid': error ? true : control.props['aria-invalid'] })}
    {error && <p id={`${id}-error`} className="ui-field-error" role="alert">{error}</p>}
  </div>
}

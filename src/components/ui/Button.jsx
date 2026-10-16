import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export default function Button({ to, children, variant = 'primary', className = '', disabled = false, ...props }) {
  const classes = cn('btn', 'ui-button', variant, className)
  if (to && disabled) return <a {...props} role="link" className={classes} aria-disabled="true" tabIndex={-1} onClick={event => event.preventDefault()}>{children}</a>
  if (to) return <Link {...props} to={to} className={classes}>{children}</Link>
  // Preserve native submit behaviour for existing forms unless a caller supplies type.
  return <button {...props} className={classes} disabled={disabled}>{children}</button>
}

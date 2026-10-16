import { cn } from '../../lib/cn'
export default function Badge({ children, tone = 'neutral', className = '', ...props }) {
  return <span {...props} className={cn('tag', 'ui-badge', `ui-badge-${tone}`, className)}>{children}</span>
}

import { cn } from '../../lib/cn'
export default function Card({ children, className = '', ...props }) {
  return <article {...props} className={cn('card', 'ui-card', className)}>{children}</article>
}

import { cn } from '../../lib/cn'
export default function SectionHeading({ eyebrow, title, text, className = '', ...props }) {
  return <div {...props} className={cn('section-heading', 'ui-section-heading', className)}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{text && <p className="muted">{text}</p>}</div>
}

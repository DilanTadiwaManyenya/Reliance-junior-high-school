export function PortalPageHeader({ eyebrow, title, description, actions, children }) {
  return <header className="ui-page-header"><div className="ui-page-heading">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}{children}</div>{actions && <div className="ui-action-bar">{actions}</div>}</header>
}

export function ActionBar({ children, label = 'Form actions' }) {
  return <div className="ui-action-bar" role="group" aria-label={label}>{children}</div>
}

export function FilterPanel({ children, label = 'Filters', count = 0 }) {
  return <details className="ui-filter-panel"><summary>{label}{count > 0 && <span> · {count} applied</span>}</summary><div className="ui-filter-content">{children}</div></details>
}

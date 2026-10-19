import { useEffect, useRef } from 'react'
const tabs = [
  ['fees', 'Finance'], ['learner-profiles', 'Learner profiles'],
  ['progress-reports', 'Academic progress'], ['expenses', 'Expenses & Cashbook'],
  ['inventory', 'Point of sale'], ['historical-reports', 'Historical reports'],
]
export default function AccountantWorkspaceNav({ section, onChange }) {
  const menu = useRef(null)
  useEffect(() => {
    const mobile = matchMedia('(max-width: 900px)')
    const update = () => { menu.current.open = !mobile.matches }
    update()
    mobile.addEventListener('change', update)
    return () => mobile.removeEventListener('change', update)
  }, [])
  const select = id => {
    onChange(id)
    if (matchMedia('(max-width: 900px)').matches) {
      menu.current.open = false
      menu.current.querySelector('summary').focus()
    }
  }
  return <nav className="accountant-workspace-nav" aria-label="Accountant workspace">
    <details ref={menu} className="accountant-workspace-menu">
      <summary>Workspace: <strong>{tabs.find(([id]) => id === section)?.[1] || 'Finance'}</strong></summary>
      <div className="accountant-workspace-options">{tabs.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => select(id)}>{label}</button>)}</div>
    </details>
  </nav>
}

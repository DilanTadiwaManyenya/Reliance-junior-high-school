const tabs = [
  ['fees', 'Finance'], ['learner-profiles', 'Learner profiles'],
  ['progress-reports', 'Academic progress'], ['expenses', 'Expenses & Cashbook'],
  ['inventory', 'Inventory & POS'],
]
export default function AccountantWorkspaceNav({ section, onChange }) {
  return <nav className="accountant-workspace-nav" aria-label="Accountant workspace">{tabs.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onChange(id)}>{label}</button>)}</nav>
}

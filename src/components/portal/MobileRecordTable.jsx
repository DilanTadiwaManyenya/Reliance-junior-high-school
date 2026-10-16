import { Children, cloneElement, isValidElement } from 'react'

// Keep one set of records and actions, with explicit table semantics after mobile reflow.
export default function MobileRecordTable({ children, className = '', ...props }) {
  const sections = Children.toArray(children)
  const header = sections.find(child => isValidElement(child) && child.type === 'thead')
  const headerRow = Children.toArray(header?.props.children)[0]
  const labels = Children.toArray(headerRow?.props.children).map(cell => cell.props['aria-label'] || cell.props.children || 'Actions')
  const rows = section => Children.map(section.props.children, row => {
    if (!isValidElement(row) || row.type !== 'tr') return row
    let index = 0
    return cloneElement(row, { role: 'row' }, Children.map(row.props.children, cell => {
      if (!isValidElement(cell)) return cell
      const label = cell.props.colSpan ? undefined : labels[index++]
      return cloneElement(cell, { role: 'cell', 'data-label': typeof label === 'string' ? label : undefined })
    }))
  })
  return <table {...props} role="table" className={className}>{sections.map(section => {
    if (!isValidElement(section)) return section
    if (section.type === 'tbody') return cloneElement(section, { role: 'rowgroup' }, rows(section))
    if (section.type === 'thead') return cloneElement(section, { role: 'rowgroup' }, Children.map(section.props.children, row => cloneElement(row, { role: 'row' }, Children.map(row.props.children, cell => isValidElement(cell) ? cloneElement(cell, { role: 'columnheader', scope: 'col' }) : cell))))
    return section
  })}</table>
}

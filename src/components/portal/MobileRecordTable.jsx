import { Children, cloneElement, Fragment, isValidElement } from 'react'

const headerText = value => Array.isArray(value) ? value.map(headerText).join('')
  : isValidElement(value) ? headerText(value.props.children)
    : typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const flattenedChildren = children => Children.toArray(children).flatMap(child => (
  isValidElement(child) && child.type === Fragment
    ? flattenedChildren(child.props.children)
    : [child]
))

// Keep one set of records and actions, with explicit table semantics after mobile reflow.
export default function MobileRecordTable({ children, className = '', ...props }) {
  const sections = Children.toArray(children)
  const header = sections.find(child => isValidElement(child) && child.type === 'thead')
  const headerRow = Children.toArray(header?.props.children)[0]
  const labels = flattenedChildren(headerRow?.props.children).map(cell => cell.props['aria-label'] || headerText(cell.props.children) || 'Actions')
  const rows = section => Children.map(section.props.children, row => {
    if (!isValidElement(row) || row.type !== 'tr') return row
    let index = 0
    const cloneCells = children => Children.map(children, cell => {
      if (!isValidElement(cell)) return cell
      if (cell.type === Fragment) return cloneElement(cell, {}, cloneCells(cell.props.children))
      const label = cell.props.colSpan ? undefined : labels[index++]
      return cloneElement(cell, { role: 'cell', 'data-label': typeof label === 'string' ? label : undefined })
    })
    return cloneElement(row, { role: 'row' }, cloneCells(row.props.children))
  })
  const cloneHeaderCells = children => Children.map(children, cell => {
    if (!isValidElement(cell)) return cell
    if (cell.type === Fragment) return cloneElement(cell, {}, cloneHeaderCells(cell.props.children))
    return cloneElement(cell, { role: 'columnheader', scope: 'col' })
  })
  return <table {...props} role="table" className={className}>{sections.map(section => {
    if (!isValidElement(section)) return section
    if (section.type === 'tbody') return cloneElement(section, { role: 'rowgroup' }, rows(section))
    if (section.type === 'thead') return cloneElement(section, { role: 'rowgroup' }, Children.map(section.props.children, row => cloneElement(row, { role: 'row' }, cloneHeaderCells(row.props.children))))
    return section
  })}</table>
}

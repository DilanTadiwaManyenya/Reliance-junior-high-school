import { useEffect } from 'react'
import '../reportPrint.css'

// Explicit ancestor markers also work in browsers without CSS :has().
export function useReportPrint(id) {
  useEffect(() => {
    let marked = []
    const pageStyle = document.createElement('style')
    pageStyle.textContent = '@page { size: A4 portrait; margin: 6mm; }'
    const prepare = () => {
      const report = document.getElementById(id)
      if (!report) return
      document.head.append(pageStyle)
      document.body.classList.add('printing-academic-report')
      report.setAttribute('data-print-report', '')
      report.style.setProperty('--report-print-scale', '1')
      let ancestor = report.parentElement
      while (ancestor) {
        ancestor.setAttribute('data-report-print-ancestor', '')
        marked.push(ancestor)
        ancestor = ancestor.parentElement
      }
      // Fit the complete report, including comments and signatures, without clipping.
      const height = Math.max(report.scrollHeight, report.getBoundingClientRect().height)
      report.style.setProperty('--report-print-scale', String(Math.min(1, (283 * 96 / 25.4) / height)))
    }
    const restore = () => {
      pageStyle.remove()
      document.body.classList.remove('printing-academic-report')
      const report = document.getElementById(id)
      report?.removeAttribute('data-print-report')
      report?.style.removeProperty('--report-print-scale')
      marked.forEach(element => element.removeAttribute('data-report-print-ancestor'))
      marked = []
    }
    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', restore)
    return () => {
      restore()
      window.removeEventListener('beforeprint', prepare)
      window.removeEventListener('afterprint', restore)
    }
  }, [id])
}



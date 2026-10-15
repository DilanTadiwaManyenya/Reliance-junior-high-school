import { useEffect } from 'react'
import '../reportPrint.css'

// Explicit ancestor markers also work in browsers without CSS :has().
export function useReportPrint(id) {
  useEffect(() => {
    let marked = []
    const prepare = () => {
      const report = document.getElementById(id)
      if (!report) return
      document.body.classList.add('printing-academic-report')
      report.setAttribute('data-print-report', '')
      let ancestor = report.parentElement
      while (ancestor) {
        ancestor.setAttribute('data-report-print-ancestor', '')
        marked.push(ancestor)
        ancestor = ancestor.parentElement
      }
    }
    const restore = () => {
      document.body.classList.remove('printing-academic-report')
      document.getElementById(id)?.removeAttribute('data-print-report')
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

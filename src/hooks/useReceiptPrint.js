import { useEffect } from 'react'

export function useReceiptPrint(receiptNumber) {
  useEffect(() => {
    if (!receiptNumber) return
    let ancestors = [], root = null, originalTitle = null
    const style = document.createElement('style')
    style.textContent = '@page { size: A4 portrait; margin: 10mm; }'
    const restore = () => {
      style.remove()
      document.body.classList.remove('printing-shop-receipt')
      root?.removeAttribute('data-print-receipt')
      ancestors.forEach(element => element.removeAttribute('data-receipt-ancestor'))
      ancestors = []
      if (originalTitle !== null) { document.title = originalTitle; originalTitle = null }
    }
    const prepare = () => {
      if (document.body.classList.contains('printing-shop-receipt')) return
      root = document.querySelector('.shop-receipt')
      if (!root) return
      originalTitle = document.title
      document.title = `Reliance receipt ${receiptNumber}`
      root.setAttribute('data-print-receipt', '')
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
        parent.setAttribute('data-receipt-ancestor', ''); ancestors.push(parent)
      }
      document.head.append(style)
      document.body.classList.add('printing-shop-receipt')
    }
    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', restore)
    return () => { restore(); window.removeEventListener('beforeprint', prepare); window.removeEventListener('afterprint', restore) }
  }, [receiptNumber])
}

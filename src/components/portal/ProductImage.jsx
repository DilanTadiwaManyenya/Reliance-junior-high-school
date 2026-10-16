import { useState } from 'react'
import './ProductImage.css'

export default function ProductImage({ url, name, className = '' }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return <div className={`catalog-image ${className}`}>
    {url && url !== failedUrl
      ? <img src={url} alt={name} loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />
      : <span role="img" aria-label={`No photo for ${name || 'this product'}`} className="catalog-image-placeholder">No photo available</span>}
  </div>
}

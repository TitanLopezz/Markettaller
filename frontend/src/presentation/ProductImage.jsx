import { useState } from 'react'
import { isWebImageUrl, normalizeImageUrl } from '../imageUrl'

export default function ProductImage({ src, alt = '', className = 'product-image', emptyClassName = 'product-image product-image-empty' }) {
  const [failedSource, setFailedSource] = useState('')
  const source = normalizeImageUrl(src)

  if (!isWebImageUrl(source) || failedSource === source) {
    const message = source ? 'Imagen no disponible' : 'Sin imagen'
    return <div className={emptyClassName} role="img" aria-label={alt ? `${alt}: ${message}` : message}>{message}</div>
  }

  return <img className={className} src={source} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
}

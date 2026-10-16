import { useEffect, useRef, useState } from 'react'
import { DEFAULT_PHOTO_EDIT, drawProductPhoto, compressProductPhoto, photoSize } from '../../lib/productPhotoEditor'

export default function ProductPhotoEditor({ source, onApply, onCancel }) {
  const [edit, setEdit] = useState(DEFAULT_PHOTO_EDIT)
  const [image, setImage] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)
  const drag = useRef(null)
  useEffect(() => {
    let disposed = false; let bitmap
    createImageBitmap(source).then(value => {
      bitmap = value
      if (disposed) bitmap.close()
      else setImage(bitmap)
    }).catch(() => { if (!disposed) setError('This image could not be read. Choose another JPG, PNG or WebP.') })
    return () => { disposed = true; bitmap?.close() }
  }, [source])
  useEffect(() => {
    if (!image || !canvasRef.current) return undefined
    let disposed = false
    drawProductPhoto(canvasRef.current, image, edit)
    const timer = setTimeout(async () => {
      try {
        const canvas = document.createElement('canvas')
        drawProductPhoto(canvas, image, edit)
        const compressed = await compressProductPhoto(canvas, edit.quality)
        if (!disposed) setResult({ ...compressed, edit })
      } catch (reason) { if (!disposed) setError(reason.message) }
    }, 160)
    return () => { disposed = true; clearTimeout(timer) }
  }, [image, edit])
  const current = result?.edit === edit
  const change = patch => { setError(''); setEdit(value => ({ ...value, ...patch })) }
  const pointerMove = event => {
    if (!drag.current) return
    const width = event.currentTarget.getBoundingClientRect().width
    const clamp = value => Math.min(1, Math.max(-1, value))
    change({ x: clamp(drag.current.x + (event.clientX - drag.current.px) / width * 2), y: clamp(drag.current.y + (event.clientY - drag.current.py) / width * 2) })
  }
  return <section className="shop-photo-editor" aria-label="Photo editor">
    <h3>Edit product photo</h3>
    <p>Drag to position the photo, or use the position sliders. Nothing uploads until you save the product.</p>
    {error && <p role="alert">{error}</p>}
    <canvas ref={canvasRef} aria-label="Square photo crop preview" onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { px: event.clientX, py: event.clientY, x: edit.x, y: edit.y }
    }} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} />
    <div className="shop-photo-controls">
      <label>Photo framing<select aria-label="Photo framing" value={edit.mode} onChange={event => change({ mode: event.target.value, zoom: 1, x: 0, y: 0 })}>
        <option value="fit">Fit whole image</option><option value="crop">Crop to square</option>
      </select></label>
      <label>Photo compression<select aria-label="Photo compression" value={edit.quality} onChange={event => change({ quality: event.target.value })}>
        <option value="balanced">Balanced data use (about 160 KB)</option><option value="small">Smaller file (about 90 KB)</option><option value="clear">More detail (about 220 KB)</option>
      </select></label>
      <label>Photo zoom<input type="range" min="1" max="3" step="0.01" value={edit.zoom} onChange={event => change({ zoom: Number(event.target.value) })} /></label>
      <label>Horizontal photo position<input type="range" min="-1" max="1" step="0.01" value={edit.x} onChange={event => change({ x: Number(event.target.value) })} /></label>
      <label>Vertical photo position<input type="range" min="-1" max="1" step="0.01" value={edit.y} onChange={event => change({ y: Number(event.target.value) })} /></label>
    </div>
    <div className="shop-photo-actions">
      <button type="button" onClick={() => change({ rotation: (edit.rotation + 90) % 360, x: 0, y: 0 })}>Rotate photo</button>
      <button type="button" onClick={() => { setError(''); setEdit({ ...DEFAULT_PHOTO_EDIT }) }}>Reset photo</button>
    </div>
    <p role="status" aria-live="polite">Original: {photoSize(source.size)}. {current ? `Ready to save: ${photoSize(result.blob.size)} WebP · ${result.width} × ${result.height}px. Actual size depends on image detail.` : 'Preparing compressed preview…'}</p>
    <div className="shop-photo-actions">
      <button type="button" onClick={onCancel}>Cancel photo edit</button>
      <button type="button" className="primary" disabled={!current || !!error} onClick={() => onApply(result.blob)}>Use edited photo</button>
    </div>
  </section>
}


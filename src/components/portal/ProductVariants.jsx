import { useState } from 'react'

function SizeRow({ variant, save, busy }) {
  const [draft, setDraft] = useState(variant)
  return <div className="shop-size-row">
    <label>Size<input maxLength={40} value={draft.size} onChange={e => setDraft({ ...draft, size: e.target.value })} /></label>
    <label>Size SKU<input value={draft.sku || ''} onChange={e => setDraft({ ...draft, sku: e.target.value })} /></label>
    <label>Stock<input type="number" min="0" step="1" value={draft.quantity_on_hand} onChange={e => setDraft({ ...draft, quantity_on_hand: e.target.value })} /></label>
    <label className="shop-checkbox"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />Show size</label>
    <button type="button" disabled={busy} onClick={() => save(draft, variant)}>Save size</button>
  </div>
}

export default function ProductVariants({ product, supabase, onSaved, onBusy }) {
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newSize, setNewSize] = useState({ size: '', sku: '', quantity_on_hand: '0', active: true })
  const save = async (draft, original) => {
    if (busy) return
    setError(''); setNotice('')
    const payload = { size: draft.size.trim(), sku: draft.sku?.trim() || null, quantity_on_hand: Number(draft.quantity_on_hand), active: draft.active }
    if (!payload.size || !Number.isInteger(payload.quantity_on_hand) || payload.quantity_on_hand < 0) {
      setError('Enter a size and a non-negative whole stock quantity.'); return
    }
    setBusy(true); onBusy(true)
    try {
      const request = original?.id
        ? supabase.from('product_variants').update(payload).eq('id', original.id).eq('quantity_on_hand', original.quantity_on_hand)
        : supabase.from('product_variants').insert({ ...payload, product_id: product.id })
      const result = await request.select('id').single()
      if (result.error) throw result.error
      const current = await supabase.from('inventory_products').select('*,product_variants(*)').eq('id', product.id).single()
      if (current.error) throw current.error
      await onSaved(current.data)
      setNewSize({ size: '', sku: '', quantity_on_hand: '0', active: true })
      setNotice('Size saved. Product stock now totals its visible sizes.')
    } catch (error) { setError(`${error.message} If stock changed during editing, close and reopen the product before retrying.`) }
    finally { setBusy(false); onBusy(false) }
  }
  return <section className="shop-size-editor" aria-label="Product sizes">
    <h3>Sizes and stock</h3>
    <p>Sizes save separately. Hide a size to stop selling it; past orders keep their original size. To add sizes to existing stock, first adjust unsized stock to zero, then enter those same quantities by size.</p>
    {error && <p role="alert" className="shop-message error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {(product.product_variants || []).map(variant => <SizeRow key={`${variant.id}:${variant.quantity_on_hand}:${variant.size}:${variant.active}:${variant.sku}`} variant={variant} save={save} busy={busy} />)}
    <div className="shop-size-row">
      <label>New size<input maxLength={40} value={newSize.size} onChange={e => setNewSize({ ...newSize, size: e.target.value })} /></label>
      <label>New size SKU<input value={newSize.sku} onChange={e => setNewSize({ ...newSize, sku: e.target.value })} /></label>
      <label>New size stock<input type="number" min="0" step="1" value={newSize.quantity_on_hand} onChange={e => setNewSize({ ...newSize, quantity_on_hand: e.target.value })} /></label>
      <button type="button" disabled={busy || (!product.has_variants && product.quantity_on_hand > 0)} onClick={() => save(newSize)}>Add size</button>
    </div>
  </section>
}

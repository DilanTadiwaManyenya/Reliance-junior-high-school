export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024

export async function prepareProductImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.')
  }
  if (!file.size || file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('Images must be no larger than 2 MB.')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be read. Choose another JPG, PNG or WebP.') })
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || blob.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('Unable to compress this image below 2 MB. Choose a smaller image.')
    return blob
  } finally { bitmap.close() }
}

export async function uploadProductImage(supabase, blob, campus) {
  if (!['junior', 'senior'].includes(campus)) throw new Error('Choose the product campus before uploading its photo.')
  const extension = blob.type === 'image/webp' ? 'webp' : 'png'
  const path = `${campus}/${crypto.randomUUID()}.${extension}`
  const bucket = supabase.storage.from(PRODUCT_IMAGE_BUCKET)
  const { error } = await bucket.upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' })
  if (error) throw error
  return bucket.getPublicUrl(path).data.publicUrl
}

export async function removeProductImage(supabase, url) {
  if (!url) return
  const bucket = supabase.storage.from(PRODUCT_IMAGE_BUCKET)
  const base = bucket.getPublicUrl('').data.publicUrl
  // Only remove this project's managed images, never an arbitrary external URL.
  if (!url.startsWith(base)) return
  const path = url.slice(base.length)
  if (!/^(junior|senior)\/[\w-]+\.(webp|png|jpe?g)$/.test(path)) return
  const { error } = await bucket.remove([path])
  if (error) throw error
}

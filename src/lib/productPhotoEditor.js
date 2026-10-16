export const DEFAULT_PHOTO_EDIT = { mode: 'fit', zoom: 1, x: 0, y: 0, rotation: 0, quality: 'balanced' }

export function drawProductPhoto(canvas, image, edit, side = 1000) {
  canvas.width = side; canvas.height = side
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, side, side)
  const swapped = edit.rotation % 180 !== 0
  const width = swapped ? image.height : image.width
  const height = swapped ? image.width : image.height
  const scale = (edit.mode === 'crop' ? Math.max(side / width, side / height) : Math.min(side / width, side / height)) * edit.zoom
  const travelX = Math.abs(width * scale - side) / 2
  const travelY = Math.abs(height * scale - side) / 2
  ctx.save()
  ctx.translate(side / 2 + edit.x * travelX, side / 2 + edit.y * travelY)
  ctx.rotate(edit.rotation * Math.PI / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(image, -image.width / 2, -image.height / 2)
  ctx.restore()
}

export async function compressProductPhoto(canvas, quality = 'balanced') {
  const target = { small: 90, balanced: 160, clear: 220 }[quality] * 1024
  let blob
  // Start at full resolution; reduce quality before dimensions when needed.
  for (const side of [1000, 800, 640]) {
    const output = document.createElement('canvas'); output.width = side; output.height = side
    output.getContext('2d').drawImage(canvas, 0, 0, side, side)
    for (const level of [0.84, 0.74, 0.64, 0.55]) {
      blob = await new Promise(resolve => output.toBlob(resolve, 'image/webp', level))
      if (!blob || blob.type !== 'image/webp') throw new Error('Your browser could not prepare WebP. Try an updated browser.')
      if (blob.size <= target) return { blob, width: side, height: side }
    }
  }
  return { blob, width: 640, height: 640 }
}

export const photoSize = bytes => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
